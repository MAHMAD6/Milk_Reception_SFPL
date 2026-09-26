/**
 * Helpers for reading caught values without `any`. Anything can be thrown in JS,
 * so `catch` bindings are `unknown`; these read the common fields safely.
 */

function field(error: unknown, key: string): unknown {
  return typeof error === 'object' && error !== null ? (error as Record<string, unknown>)[key] : undefined;
}

/** The error's message, or '' when there is none (so `getErrorMessage(e) || 'fallback'` works). */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const message = field(error, 'message');
  return typeof message === 'string' ? message : '';
}

/** A string `code` (e.g. Prisma "P2002" or a domain error code), if present. */
export function getErrorCode(error: unknown): string | undefined {
  const code = field(error, 'code');
  return typeof code === 'string' ? code : undefined;
}

/** The error's `name` (e.g. "ZodError"), if present. */
export function getErrorName(error: unknown): string | undefined {
  const name = field(error, 'name');
  return typeof name === 'string' ? name : undefined;
}

/** A numeric `statusCode` carried by domain errors, if present. */
export function getErrorStatusCode(error: unknown): number | undefined {
  const status = field(error, 'statusCode');
  return typeof status === 'number' ? status : undefined;
}

/** Prisma's `meta` object (e.g. `{ target: [...] }` on unique violations), if present. */
export function getErrorMeta(error: unknown): Record<string, unknown> | undefined {
  const meta = field(error, 'meta');
  return typeof meta === 'object' && meta !== null ? (meta as Record<string, unknown>) : undefined;
}

/** Zod-style validation details (`issues`, or the older `errors` alias), if present. */
export function getErrorIssues(error: unknown): Array<{ path?: PropertyKey[]; message?: string }> | undefined {
  const issues = field(error, 'issues') ?? field(error, 'errors');
  return Array.isArray(issues) ? issues : undefined;
}

/** Prisma unique-violation target columns as a comma-separated string ('' when absent). */
export function getErrorMetaTarget(error: unknown): string {
  const target = getErrorMeta(error)?.target;
  return Array.isArray(target) ? target.join(',') : String(target || '');
}
