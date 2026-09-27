import { jwtVerify, type JWTPayload } from 'jose';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Session primitives shared by route handlers (via auth.ts) and the request proxy.
 * Kept free of Prisma imports so the proxy can verify tokens without a DB round-trip.
 */

export const SESSION_COOKIE_NAME = 'auth_token';
export const SESSION_ISSUER = 'sfpl-milk-reception';
export const SESSION_AUDIENCE = 'sfpl-milk-reception:session';
export const MOT_OFFLINE_AUDIENCE = 'sfpl-milk-reception:mot-offline';

export const NORMAL_SESSION_TTL = 12 * 60 * 60; // 12 hours in seconds
export const REMEMBERED_SESSION_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

const MIN_PRODUCTION_SECRET_LENGTH = 32;

export function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is missing or empty. Token operations cannot be performed.');
  }
  if (process.env.NODE_ENV === 'production' && secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production.`);
  }
  return new TextEncoder().encode(secret);
}

/**
 * Binds a session to the password it was issued under. Any password change or reset
 * produces a new hash, so every previously issued session stops verifying.
 */
export function passwordFingerprint(passwordHash: string | null | undefined): string {
  return createHmac('sha256', getJwtSecretKey())
    .update(`pwv:${passwordHash ?? ''}`)
    .digest('base64url')
    .slice(0, 22);
}

export function fingerprintsMatch(expected: string, actual: unknown): boolean {
  if (typeof actual !== 'string' || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

/** Exact-name cookie lookup (a regex would also match e.g. `x_auth_token`). */
export function readSessionTokenFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    const value = part.slice(separator + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

/** Verifies signature, expiry, issuer, audience and token purpose. No DB access. */
export async function verifySessionJwt(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), {
      algorithms: ['HS256'],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    return payload.token_use === 'session' ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Secure cookies by default in production. Plants that serve the app over plain HTTP
 * on a closed intranet can opt out with SESSION_COOKIE_SECURE=false.
 */
export function isSecureCookie(): boolean {
  const override = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (override === 'true') return true;
  if (override === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
