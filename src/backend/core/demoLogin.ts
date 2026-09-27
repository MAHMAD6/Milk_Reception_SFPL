/**
 * Demo sign-in shortcuts expose the passwords `prisma/seed.ts` assigns to demo accounts,
 * so they are only acceptable where the database holds demo data. Enabled automatically
 * under `next dev`; any other environment must opt in with ENABLE_DEMO_LOGIN=true.
 */
export function isDemoLoginEnabled(): boolean {
  const flag = process.env.ENABLE_DEMO_LOGIN?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV === 'development';
}
