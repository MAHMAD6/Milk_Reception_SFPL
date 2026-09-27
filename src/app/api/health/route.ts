import { NextResponse } from 'next/server';
import { prisma } from '@core/db';

export const dynamic = 'force-dynamic';

/** Liveness + database readiness probe for load balancers and container orchestrators. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: unknown) {
    console.error('[HEALTH_CHECK_DB_ERROR]', err);
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
