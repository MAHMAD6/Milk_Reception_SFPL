import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

/**
 * Guards /api/cron/* endpoints. Schedulers call them with
 * `Authorization: Bearer $CRON_SECRET` (or `x-cron-secret`). Returns an error response
 * to send back, or null when the caller is authorized.
 */
export function rejectUnauthorizedCron(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'Cron endpoint is disabled. Set CRON_SECRET to enable it.' }, { status: 503 });
  }
  const header = req.headers.get('authorization') || '';
  const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : req.headers.get('x-cron-secret')?.trim() || '';
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return null;
}
