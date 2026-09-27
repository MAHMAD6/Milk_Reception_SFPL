import { NextResponse } from 'next/server';
import { rejectUnauthorizedCron } from '@core/cronAuth';
import { isPushConfigured, processPushQueue } from '@/backend/services/pushDeliveryService';

export const dynamic = 'force-dynamic';

/**
 * Sends queued Web Push notifications. Call from a scheduler every minute with
 * `Authorization: Bearer $CRON_SECRET`.
 */
async function run(req: Request) {
  const rejected = rejectUnauthorizedCron(req);
  if (rejected) return rejected;
  if (!isPushConfigured()) {
    return NextResponse.json({ success: true, skipped: true, reason: 'Web Push (VAPID) not configured.' });
  }

  try {
    return NextResponse.json({ success: true, ...(await processPushQueue()) });
  } catch (error: unknown) {
    console.error('[CRON_PROCESS_PUSH_ERROR]', error);
    return NextResponse.json({ error: 'Failed to process push queue.' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
