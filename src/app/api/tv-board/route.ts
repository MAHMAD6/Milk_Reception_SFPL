import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getCurrentUser } from '@core/auth';
import { getAdminHeadDashboard } from '@/backend/services/adminHeadDashboardService';

export const dynamic = 'force-dynamic';

/**
 * Unattended yard monitors can load the board without a user session by opening
 * /tv-board?key=<TV_BOARD_ACCESS_KEY>. Without that env var the board requires sign-in.
 */
function hasKioskKey(req: Request): boolean {
  const expected = process.env.TV_BOARD_ACCESS_KEY?.trim();
  if (!expected) return false;
  const presented = new URL(req.url).searchParams.get('key') || '';
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!hasKioskKey(req) && !(await getCurrentUser(req))) {
    return NextResponse.json({ error: 'Unauthorized. Authentication required.' }, { status: 401 });
  }

  try {
    const dashboard = await getAdminHeadDashboard();
    const vehicles = dashboard.vehicles.map(({ visitId, vehicleNumber, stage }) => ({ visitId, vehicleNumber, stage }));
    return NextResponse.json({ vehicles }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err: unknown) {
    console.error('[API_TV_BOARD_ERROR]', err);
    return NextResponse.json({ error: 'Failed to load yard status.' }, { status: 500 });
  }
}
