/**
 * Server environment validation. Called once at startup from src/instrumentation.ts so a
 * misconfigured production deployment fails fast instead of failing on first request.
 */
export function validateServerEnv(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.DATABASE_URL?.trim()) {
    errors.push('DATABASE_URL is not set.');
  }

  const secret = process.env.JWT_SECRET?.trim() || '';
  if (!secret) {
    errors.push('JWT_SECRET is not set.');
  } else if (isProduction && secret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters in production (generate one with `openssl rand -base64 48`).');
  } else if (isProduction && /your-jwt-secret|change-me|ci-dummy/i.test(secret)) {
    errors.push('JWT_SECRET still holds a placeholder value.');
  }

  if (isProduction && process.env.ENABLE_DEMO_LOGIN?.trim().toLowerCase() === 'true') {
    warnings.push('ENABLE_DEMO_LOGIN=true exposes demo account passwords on the login page. Use only for demo environments.');
  }
  if (isProduction && process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase() === 'false') {
    warnings.push('SESSION_COOKIE_SECURE=false sends session cookies over plain HTTP. Serve the app over HTTPS where possible.');
  }

  for (const warning of warnings) console.warn(`[env] ${warning}`);
  if (errors.length > 0) {
    const message = `Invalid server environment:\n  - ${errors.join('\n  - ')}`;
    if (isProduction) {
      // Next.js catches errors thrown from instrumentation and keeps serving 500s;
      // exit instead so the process manager / orchestrator surfaces the misconfiguration.
      console.error(`[env] ${message}`);
      process.exit(1);
    }
    console.warn(`[env] ${message}`);
  }
}
