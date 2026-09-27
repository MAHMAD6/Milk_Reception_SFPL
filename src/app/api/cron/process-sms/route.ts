import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@core/db';
import { isSmsProviderConfigured, sendSms } from '@/backend/services/smsProvider';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;

/** Stored for operators only. fetch() failures hide the reason (e.g. ECONNREFUSED) in `cause`. */
function describeDeliveryError(error: unknown): string {
  const err = error as { message?: unknown; cause?: { code?: unknown; message?: unknown } } | null;
  const message = typeof err?.message === 'string' ? err.message : 'SMS delivery failed.';
  const cause = err?.cause?.code ?? err?.cause?.message;
  return cause ? `${message} (${String(cause)})` : message;
}

function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get('authorization') || '';
  const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : req.headers.get('x-cron-secret')?.trim() || '';
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Drains the MOT collection SMS outbox. Call from a scheduler (cron, systemd timer,
 * Kubernetes CronJob) every minute with `Authorization: Bearer $CRON_SECRET`.
 */
async function processOutbox(req: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: 'Cron endpoint is disabled. Set CRON_SECRET to enable it.' }, { status: 503 });
  }
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!isSmsProviderConfigured()) {
    // Leave messages PENDING rather than pretending they were delivered.
    return NextResponse.json({ success: true, skipped: true, reason: 'SMS provider not configured.' });
  }

  try {
    const pendingMessages = await prisma.motCollectionSmsOutbox.findMany({
      where: { status: 'PENDING', attempt_count: { lt: MAX_ATTEMPTS } },
      take: BATCH_SIZE,
      orderBy: { created_at: 'asc' },
    });

    let sent = 0;
    let failed = 0;

    for (const msg of pendingMessages) {
      // Claim this attempt with an optimistic lock on attempt_count so overlapping
      // scheduler runs never send the same message twice.
      const claimed = await prisma.motCollectionSmsOutbox.updateMany({
        where: { id: msg.id, status: 'PENDING', attempt_count: msg.attempt_count },
        data: { attempt_count: { increment: 1 } },
      });
      if (claimed.count !== 1) continue;

      try {
        const result = await sendSms(msg.recipient_phone, msg.message_body);
        await prisma.motCollectionSmsOutbox.update({
          where: { id: msg.id },
          data: { status: 'SENT', sent_at: new Date(), provider_message_id: result.providerMessageId, last_error: null },
        });
        sent++;
      } catch (error: unknown) {
        const attempts = msg.attempt_count + 1;
        await prisma.motCollectionSmsOutbox.update({
          where: { id: msg.id },
          data: {
            status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
            last_error: describeDeliveryError(error).slice(0, 1000),
          },
        });
        failed++;
      }
    }

    return NextResponse.json({ success: true, processed: sent, failed });
  } catch (error: unknown) {
    console.error('[CRON_PROCESS_SMS_ERROR]', error);
    return NextResponse.json({ error: 'Failed to process SMS outbox.' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return processOutbox(req);
}

export async function POST(req: Request) {
  return processOutbox(req);
}
