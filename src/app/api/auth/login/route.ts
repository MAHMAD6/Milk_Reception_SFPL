import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, NORMAL_SESSION_TTL, REMEMBERED_SESSION_TTL } from '@core/auth';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@core/session';
import { consumeRateLimit, getClientIp, resetRateLimit } from '@core/rateLimit';
import { Role, User } from '@core/types';
import { prisma } from '@core/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(100, 'Username too long'),
  password: z.string().min(1, 'Password is required').max(100, 'Password too long'),
  rememberMe: z.boolean().optional().default(false),
});

const INVALID_CREDENTIALS = 'Invalid username or password';
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_USERNAME = 10;
const MAX_ATTEMPTS_PER_IP = 50;

// Compared against when the username does not exist so response timing does not
// reveal which usernames are valid.
const DUMMY_HASH = bcrypt.hashSync('timing-equalisation-placeholder', 10);

function tooManyAttempts(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'Too many sign-in attempts. Please wait and try again.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}

export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid input format' }, { status: 400 });
  }

  // STRICT ZOD VALIDATION: Block Prototype Pollution & Type Juggling
  const parseResult = loginSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid input format' }, { status: 400 });
  }

  const { username, password, rememberMe } = parseResult.data;

  const ip = getClientIp(req);
  if (ip !== 'direct') {
    const ipLimit = consumeRateLimit(`login:ip:${ip}`, MAX_ATTEMPTS_PER_IP, WINDOW_MS);
    if (!ipLimit.allowed) return tooManyAttempts(ipLimit.retryAfterSeconds);
  }
  const userLimitKey = `login:user:${username.toLowerCase()}`;
  const userLimit = consumeRateLimit(userLimitKey, MAX_ATTEMPTS_PER_USERNAME, WINDOW_MS);
  if (!userLimit.allowed) return tooManyAttempts(userLimit.retryAfterSeconds);

  try {
    const dbUser = await prisma.user.findFirst({
      where: { username },
    });

    const isPassValid = await bcrypt.compare(password, dbUser?.password_hash || DUMMY_HASH);

    // Unknown user, missing hash, wrong password and deactivated accounts all get the
    // same response so the endpoint cannot be used to enumerate accounts.
    if (!dbUser || !dbUser.password_hash || !isPassValid || !dbUser.is_active) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    resetRateLimit(userLimitKey);

    const now = new Date();
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { last_login_at: now },
    });

    const authenticatedUser: User = {
      id: dbUser.id.toString(),
      username: dbUser.username,
      name: dbUser.full_name || dbUser.username,
      role: dbUser.role as Role,
      department: dbUser.department || 'System Operations',
      scope_type: dbUser.scope_type,
      procurement_source_id: dbUser.procurement_source_id ? dbUser.procurement_source_id.toString() : null,
      last_login_at: now.toISOString(),
    };

    const sessionTtl = rememberMe ? REMEMBERED_SESSION_TTL : NORMAL_SESSION_TTL;
    const token = await createSessionToken(authenticatedUser, rememberMe, dbUser.password_hash);

    const response = NextResponse.json({ success: true, user: authenticatedUser });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(sessionTtl));
    return response;
  } catch (err: unknown) {
    console.error('[AUTH_LOGIN_ERROR]', err);
    return NextResponse.json({ error: 'Sign-in is temporarily unavailable.' }, { status: 500 });
  }
}
