export async function register() {
  // Validate on server start only; the build stage need not hold runtime secrets.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { validateServerEnv } = await import('./backend/core/env');
    validateServerEnv();
  }
}
