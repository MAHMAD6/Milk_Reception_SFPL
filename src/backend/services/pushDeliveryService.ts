import webpush from 'web-push';
import { prisma } from '@core/db';

/**
 * Web Push delivery for in-app notifications.
 *
 * createNotificationsForEvent() queues a PUSH delivery next to each IN_APP one when push is
 * configured; /api/cron/process-push drains that queue. Each recipient's preferences apply:
 *   - push disabled, account inactive, notification read/expired/stale → SKIPPED
 *   - quiet hours (Asia/Karachi)  → deferred, except CRITICAL alerts
 *   - DIGEST mode                 → at most one summary push per hour, except CRITICAL alerts
 * A push service answering 404/410 means the device unsubscribed, so it is revoked.
 *
 * Configure with VAPID_PUBLIC_KEY (or NEXT_PUBLIC_VAPID_PUBLIC_KEY), VAPID_PRIVATE_KEY and
 * VAPID_SUBJECT (mailto: or https: contact). Generate keys with `npx web-push generate-vapid-keys`.
 */

export const PUSH_CHANNEL = 'PUSH';
const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 200;
const DIGEST_INTERVAL_MS = 60 * 60 * 1000;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const PUSH_TTL_SECONDS = 12 * 60 * 60;
const PLANT_TIMEZONE = 'Asia/Karachi';

interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

function vapidConfig(): VapidConfig | null {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || '';
  const subject = process.env.VAPID_SUBJECT?.trim() || '';
  return publicKey && privateKey && subject ? { subject, publicKey, privateKey } : null;
}

export function isPushConfigured(): boolean {
  return vapidConfig() !== null;
}

/** Minutes since midnight in plant time. */
export function plantMinutesOfDay(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: PLANT_TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  return hour * 60 + minute;
}

function parseHhMm(value: string | null | undefined): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** True when `at` falls in the [start, end) quiet window, which may wrap past midnight. */
export function isWithinQuietHours(start: string | null | undefined, end: string | null | undefined, at: Date): boolean {
  const from = parseHhMm(start);
  const to = parseHhMm(end);
  if (from === null || to === null || from === to) return false;
  const now = plantMinutesOfDay(at);
  return from < to ? now >= from && now < to : now >= from || now < to;
}

export interface PushMessage {
  title: string;
  body: string;
  path: string;
  urgency: 'normal' | 'high';
}

export interface PushTarget {
  id: bigint;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends one message to one device. Rejects with the push service's statusCode on failure. */
export type PushSender = (target: PushTarget, message: PushMessage) => Promise<void>;

const webPushSender: PushSender = async (target, message) => {
  const vapid = vapidConfig();
  if (!vapid) throw new Error('Web Push is not configured.');
  await webpush.sendNotification(
    { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
    JSON.stringify({ title: message.title, body: message.body, path: message.path }),
    { vapidDetails: vapid, TTL: PUSH_TTL_SECONDS, urgency: message.urgency, timeout: 10_000 }
  );
};

function statusCodeOf(error: unknown): number | null {
  const code = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof code === 'number' ? code : null;
}

function describeError(error: unknown): string {
  const status = statusCodeOf(error);
  const message = typeof (error as { message?: unknown })?.message === 'string' ? (error as Error).message : 'Push delivery failed.';
  return (status ? `HTTP ${status}: ${message}` : message).slice(0, 1000);
}

export interface PushRunSummary {
  sent: number;
  skipped: number;
  deferred: number;
  failed: number;
}

type QueuedDelivery = Awaited<ReturnType<typeof loadQueue>>[number];

async function loadQueue() {
  return prisma.notificationDelivery.findMany({
    where: { channel: PUSH_CHANNEL, status: 'QUEUED', attempt_count: { lt: MAX_ATTEMPTS } },
    include: {
      notification: {
        include: {
          recipient: {
            select: {
              id: true,
              is_active: true,
              notification_preferences: true,
              push_subscriptions: { where: { revoked_at: null }, select: { id: true, endpoint: true, p256dh: true, auth: true } },
            },
          },
        },
      },
    },
    orderBy: { created_at: 'asc' },
    take: BATCH_SIZE,
  });
}

async function markSkipped(delivery: QueuedDelivery, reason: string) {
  await prisma.notificationDelivery.updateMany({
    where: { id: delivery.id, status: 'QUEUED' },
    data: { status: 'SKIPPED', failure_reason: reason },
  });
}

/** Optimistic claim on attempt_count so overlapping runs never send the same delivery twice. */
async function claim(delivery: QueuedDelivery): Promise<boolean> {
  const claimed = await prisma.notificationDelivery.updateMany({
    where: { id: delivery.id, status: 'QUEUED', attempt_count: delivery.attempt_count },
    data: { attempt_count: { increment: 1 } },
  });
  return claimed.count === 1;
}

async function sendToDevices(targets: PushTarget[], message: PushMessage, send: PushSender): Promise<{ delivered: boolean; error: string | null }> {
  let delivered = false;
  let lastError: string | null = null;
  for (const target of targets) {
    try {
      await send(target, message);
      delivered = true;
    } catch (error) {
      const status = statusCodeOf(error);
      if (status === 404 || status === 410) {
        // The browser dropped this subscription; stop sending to it.
        await prisma.pushSubscription.update({ where: { id: target.id }, data: { revoked_at: new Date() } });
      }
      lastError = describeError(error);
    }
  }
  return { delivered, error: delivered ? null : lastError || 'No reachable device.' };
}

async function settle(deliveries: QueuedDelivery[], outcome: { delivered: boolean; error: string | null }, summary: PushRunSummary) {
  for (const delivery of deliveries) {
    if (outcome.delivered) {
      await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'SENT', sent_at: new Date(), failure_reason: null } });
      summary.sent++;
    } else {
      const attempts = delivery.attempt_count + 1;
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'QUEUED', failure_reason: outcome.error },
      });
      summary.failed++;
    }
  }
}

function messageFor(delivery: QueuedDelivery): PushMessage {
  const n = delivery.notification;
  return { title: n.title, body: n.body, path: n.deep_link || '/', urgency: n.priority === 'NORMAL' ? 'normal' : 'high' };
}

function digestMessage(deliveries: QueuedDelivery[]): PushMessage {
  const [first] = deliveries;
  const more = deliveries.length - 1;
  return {
    title: 'Milk Reception',
    body: more > 0 ? `${first.notification.title} (+${more} more alert${more === 1 ? '' : 's'})` : first.notification.title,
    path: deliveries.length === 1 ? first.notification.deep_link || '/' : '/',
    urgency: deliveries.some((d) => d.notification.priority !== 'NORMAL') ? 'high' : 'normal',
  };
}

export async function processPushQueue(options: { now?: Date; send?: PushSender } = {}): Promise<PushRunSummary> {
  const now = options.now ?? new Date();
  const send = options.send ?? webPushSender;
  const summary: PushRunSummary = { sent: 0, skipped: 0, deferred: 0, failed: 0 };

  const byRecipient = new Map<bigint, QueuedDelivery[]>();
  for (const delivery of await loadQueue()) {
    const key = delivery.notification.recipient_user_id;
    byRecipient.set(key, [...(byRecipient.get(key) || []), delivery]);
  }

  for (const deliveries of byRecipient.values()) {
    const recipient = deliveries[0].notification.recipient;
    const preference = recipient.notification_preferences;
    const devices: PushTarget[] = recipient.push_subscriptions;

    const deliverable: QueuedDelivery[] = [];
    for (const delivery of deliveries) {
      const n = delivery.notification;
      const skipReason = !recipient.is_active
        ? 'RECIPIENT_INACTIVE'
        : preference && !preference.push_enabled
          ? 'PUSH_DISABLED'
          : n.read_at
            ? 'ALREADY_READ'
            : (n.expires_at && n.expires_at <= now) || now.getTime() - n.created_at.getTime() > STALE_AFTER_MS
              ? 'STALE'
              : devices.length === 0
                ? 'NO_SUBSCRIPTION'
                : null;
      if (skipReason) {
        await markSkipped(delivery, skipReason);
        summary.skipped++;
      } else {
        deliverable.push(delivery);
      }
    }

    const critical = deliverable.filter((d) => d.notification.priority === 'CRITICAL');
    let routine = deliverable.filter((d) => d.notification.priority !== 'CRITICAL');

    if (routine.length && isWithinQuietHours(preference?.quiet_hours_start, preference?.quiet_hours_end, now)) {
      summary.deferred += routine.length;
      routine = [];
    }

    for (const delivery of critical) {
      if (!(await claim(delivery))) continue;
      await settle([delivery], await sendToDevices(devices, messageFor(delivery), send), summary);
    }

    if (!routine.length) continue;

    if (preference?.delivery_mode === 'DIGEST') {
      const lastDigest = await prisma.notificationDelivery.findFirst({
        where: { channel: PUSH_CHANNEL, status: 'SENT', notification: { recipient_user_id: recipient.id } },
        orderBy: { sent_at: 'desc' },
        select: { sent_at: true },
      });
      if (lastDigest?.sent_at && now.getTime() - lastDigest.sent_at.getTime() < DIGEST_INTERVAL_MS) {
        summary.deferred += routine.length;
        continue;
      }
      const claimed: QueuedDelivery[] = [];
      for (const delivery of routine) if (await claim(delivery)) claimed.push(delivery);
      if (claimed.length) await settle(claimed, await sendToDevices(devices, digestMessage(claimed), send), summary);
      continue;
    }

    for (const delivery of routine) {
      if (!(await claim(delivery))) continue;
      await settle([delivery], await sendToDevices(devices, messageFor(delivery), send), summary);
    }
  }

  return summary;
}
