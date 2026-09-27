import { NextResponse } from 'next/server';
import { getCurrentUser } from './auth';
import type { CanonicalRole, User } from './types';
import { roleIn } from './roleGroups';

export type GuardResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

export { ROLE_GROUPS } from './roleGroups';

export async function requireAuthenticated(req?: Request): Promise<GuardResult> {
  const user = await getCurrentUser(req);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized. Authentication required.' }, { status: 401 }) };
  }
  return { ok: true, user };
}

/** Authenticates the caller and requires one of `roles` (role is read live from the database). */
export async function requireRoles(req: Request | undefined, roles: readonly CanonicalRole[]): Promise<GuardResult> {
  const auth = await requireAuthenticated(req);
  if (!auth.ok) return auth;
  if (!roleIn(auth.user.role, roles)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden. Your role cannot access this resource.' }, { status: 403 }) };
  }
  return auth;
}

const INTERNAL_ERROR_NAMES = new Set([
  'TypeError',
  'ReferenceError',
  'SyntaxError',
  'RangeError',
  'EvalError',
  'URIError',
  'AggregateError',
  'DatabaseError',
  'DriverAdapterError',
]);

/**
 * True for errors whose message may reveal internals (SQL, schema, stack details):
 * Prisma/driver errors, PostgreSQL SQLSTATE errors, Node system errors and JS runtime errors.
 * Plain `Error`s and custom domain errors thrown deliberately by business rules are not internal.
 */
export function isInternalError(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  if (err.name.startsWith('PrismaClient') || INTERNAL_ERROR_NAMES.has(err.name)) return true;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && (/^P\d{4}$/.test(code) || /^[0-9A-Z]{5}$/.test(code) || /^E[A-Z]{3,}$/.test(code))) {
    return true;
  }
  return false;
}

/**
 * Message safe to return to API clients: business-rule messages pass through,
 * internal errors are replaced by `fallback`.
 */
export function safeErrorMessage(err: unknown, fallback: string): string {
  if (isInternalError(err)) return fallback;
  const message = (err as Error).message;
  return message && message.length <= 500 ? message : fallback;
}

/** Logs the full error server-side and returns a sanitized JSON error response. */
export function errorResponse(context: string, err: unknown, fallback: string, status = 500): NextResponse {
  console.error(`[${context}]`, err);
  return NextResponse.json({ error: safeErrorMessage(err, fallback) }, { status });
}
