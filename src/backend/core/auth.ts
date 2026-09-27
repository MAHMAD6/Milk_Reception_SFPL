import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { Role, User, DEFAULT_USERS, AUTHENTICATED_USERS } from './types';
import { prisma } from './db';
import {
  MOT_OFFLINE_AUDIENCE,
  NORMAL_SESSION_TTL,
  REMEMBERED_SESSION_TTL,
  SESSION_AUDIENCE,
  SESSION_COOKIE_NAME,
  SESSION_ISSUER,
  fingerprintsMatch,
  getJwtSecretKey,
  passwordFingerprint,
  readSessionTokenFromCookieHeader,
  verifySessionJwt,
} from './session';

export { DEFAULT_USERS, AUTHENTICATED_USERS, NORMAL_SESSION_TTL, REMEMBERED_SESSION_TTL };

/**
 * Issues a session JWT. `passwordHash` is fingerprinted into the token so a password
 * change or admin reset revokes every session issued before it.
 */
export async function createSessionToken(
  user: User,
  rememberMe: boolean,
  passwordHash: string
): Promise<string> {
  return await new SignJWT({
    token_use: 'session',
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    department: user.department,
    zone: user.zone || null,
    scope_type: user.scope_type || 'ALL',
    procurement_source_id: user.procurement_source_id || null,
    last_login_at: user.last_login_at || null,
    pwv: passwordFingerprint(passwordHash),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(rememberMe ? '30d' : '12h')
    .sign(getJwtSecretKey());
}

/** This token is an offline preparation receipt, never an authenticated session. */
export async function createMotOfflinePreparationToken(input: { userId: string; journeyId: string; zmccId: string; expiresAt: Date }): Promise<string> {
  return new SignJWT({ token_use: 'mot_offline_preparation', journey_id: input.journeyId, zmcc_id: input.zmccId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.userId)
    .setIssuer(SESSION_ISSUER)
    .setAudience(MOT_OFFLINE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(input.expiresAt.getTime() / 1000))
    .sign(getJwtSecretKey());
}

export async function verifySessionToken(token: string): Promise<(User & { pwv: string | null }) | null> {
  const payload = await verifySessionJwt(token);
  if (!payload) return null;
  return {
    id: payload.id as string,
    username: (payload.username as string) || (payload.id as string),
    name: payload.name as string,
    role: payload.role as Role,
    department: payload.department as string,
    zone: (payload.zone as string) || null,
    scope_type: (payload.scope_type as string) || 'ALL',
    procurement_source_id: (payload.procurement_source_id as string) || null,
    last_login_at: (payload.last_login_at as string) || null,
    pwv: typeof payload.pwv === 'string' ? payload.pwv : null,
  };
}

/**
 * Resolves the authenticated user. The JWT only proves identity; role, scope and
 * active status are always re-read from PostgreSQL on every request.
 */
export async function getCurrentUser(req?: Request): Promise<User | null> {
  let token: string | null = null;

  if (req) {
    token = readSessionTokenFromCookieHeader(req.headers.get('cookie'));
    if (!token) {
      const authHeader = req.headers.get('authorization') || '';
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim() || null;
      }
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
    } catch (_err) {
      // cookies() may fail if called outside Next.js request scope
    }
  }

  if (!token) {
    return null;
  }

  const sessionUser = await verifySessionToken(token);
  if (!sessionUser || !sessionUser.pwv) {
    return null;
  }

  // Require a valid numeric persisted database user ID from the verified JWT
  if (!sessionUser.id || !/^\d+$/.test(sessionUser.id.trim())) {
    return null;
  }

  const idBigInt = BigInt(sessionUser.id.trim());

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: idBigInt },
      select: {
        id: true,
        username: true,
        full_name: true,
        role: true,
        department: true,
        scope_type: true,
        procurement_source_id: true,
        is_active: true,
        last_login_at: true,
        password_hash: true,
        procurement_source: {
          select: {
            id: true,
            code: true,
            name: true,
            source_type: true,
            is_active: true,
          },
        },
      },
    });

    // Missing or inactive database user: UNAUTHORIZED IMMEDIATELY
    if (!dbUser || !dbUser.is_active || !dbUser.password_hash) {
      return null;
    }

    // Password changed or reset since this session was issued: revoked
    if (!fingerprintsMatch(passwordFingerprint(dbUser.password_hash), sessionUser.pwv)) {
      return null;
    }

    // Current authorization strictly derived from PostgreSQL
    return {
      id: dbUser.id.toString(),
      username: dbUser.username,
      name: dbUser.full_name || dbUser.username,
      role: dbUser.role as Role,
      department: dbUser.department || '',
      zone: sessionUser.zone || null,
      scope_type: dbUser.scope_type,
      procurement_source_id: dbUser.procurement_source_id ? dbUser.procurement_source_id.toString() : null,
      procurement_source: dbUser.procurement_source
        ? {
            id: dbUser.procurement_source.id.toString(),
            code: dbUser.procurement_source.code,
            name: dbUser.procurement_source.name,
            source_type: dbUser.procurement_source.source_type,
            is_active: dbUser.procurement_source.is_active,
          }
        : null,
      last_login_at: dbUser.last_login_at ? dbUser.last_login_at.toISOString() : null,
    };
  } catch (_err) {
    return null;
  }
}

/**
 * Strict Granular Column Visibility & Write Matrix
 */
const ROLE_ALLOWED_FIELDS: Record<string, string[]> = {
  SUPER_ADMIN: [],
  EXECUTIVE_MANAGEMENT: [],
  DATA_EXECUTIVE: [],
  HEAD_OF_MPD: [],
  ADMIN_HEAD: [],
  QA_HEAD: [],
  PRODUCTION_HEAD: [],
  FINANCE_ACCOUNTS: [],
  ZMCC_MANAGER: [],
  CONTRACTOR_MANAGER: [],
  PHE_OPERATOR: [],
  MOT: [],
  QA_MANAGER: [],
  ZMCC_LAB_ATTENDANT: [
    'vehicle_number',
    'portion_number',
    'zonal_contractor_name',
    'dispatch_date',
    'dispatch_day',
    'dispatch_week',
    'dispatch_month',
    'dispatch_year',
    'zonal_contractor_dispatch_time',
    'scheduled_arrival_time',
    'dispatch_kg_gross',
    'dispatch_liters_gross',
    'dispatch_tests',
    'dispatch_fat',
    'dispatch_lr',
    'status',
  ],
  CONTRACTOR_OPERATOR: [
    'vehicle_number',
    'portion_number',
    'zonal_contractor_name',
    'dispatch_date',
    'dispatch_day',
    'dispatch_week',
    'dispatch_month',
    'dispatch_year',
    'zonal_contractor_dispatch_time',
    'scheduled_arrival_time',
    'dispatch_kg_gross',
    'dispatch_liters_gross',
    'dispatch_tests',
    'dispatch_fat',
    'dispatch_lr',
    'status',
  ],
  SECURITY_OPERATOR: [
    'token_number',
    'igp_date',
    'igp_time',
    'first_weight_time',
    'first_weight_of_vehicle',
    'second_weight_time',
    'second_weight_of_vehicle',
    'out_from_gate_time',
    'status',
  ],
  QA_LAB_ATTENDANT: [
    'igp_date',
    'igp_time',
    'sampling_date',
    'sampling_time_start',
    'sampling_time_end',
    'sampling_tests',
    'sampling_lr',
    'sampling_fat',
    'b_mbrt_minutes_test',
    'calculated_status',
    'rejection_reasons',
    'remarks',
    'parallel_override_active',
    'parallel_override_code',
    'rm_mbrt_pending',
    'status',
  ],
  WEIGHBRIDGE_OPERATOR: [
    'first_weight_time',
    'first_weight_of_vehicle',
    'second_weight_time',
    'second_weight_of_vehicle',
    'status',
  ],
  PRODUCTION_RECEPTION_OPERATOR: [
    'reception_date',
    'reception_start_time',
    'reception_end_time',
    'silo_storage_id',
    'first_weight_of_vehicle',
    'second_weight_of_vehicle',
    'status',
  ],
};

export function filterUpdatesByRole(role: Role, updates: Record<string, unknown>): Record<string, unknown> {
  const allowed = ROLE_ALLOWED_FIELDS[role] || [];
  const sanitized: Record<string, unknown> = {};

  for (const key of Object.keys(updates)) {
    if (allowed.includes(key)) {
      sanitized[key] = updates[key];
    }
  }

  return sanitized;
}
