/**
 * Push queue behaviour against a seeded database, with a fake push transport.
 * Skipped when DATABASE_URL is unset.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import webpush from 'web-push';
import { prisma } from '@core/db';
import { createNotificationsForEvent } from '@/backend/services/notificationService';
import { plantMinutesOfDay, processPushQueue, type PushMessage, type PushSender } from '@/backend/services/pushDeliveryService';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const hhmm = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

describe('web push delivery (database)', { skip: !hasDatabase && 'DATABASE_URL not set' }, () => {
  const created = { notificationIds: [] as bigint[], subscriptionIds: [] as bigint[] };
  let mpdHeadId: bigint;
  let financeId: bigint;
  let originalPreference: Awaited<ReturnType<typeof prisma.notificationPreference.findUnique>> = null;

  before(async () => {
    const keys = webpush.generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    process.env.VAPID_SUBJECT = 'mailto:ops@example.com';

    mpdHeadId = (await prisma.user.findUniqueOrThrow({ where: { username: 'mpd.head' } })).id;
    financeId = (await prisma.user.findUniqueOrThrow({ where: { username: 'finance.accounts' } })).id;
    originalPreference = await prisma.notificationPreference.findUnique({ where: { user_id: mpdHeadId } });
    await prisma.notificationPreference.deleteMany({ where: { user_id: mpdHeadId } });
    await prisma.pushSubscription.updateMany({ where: { user_id: financeId, revoked_at: null }, data: { revoked_at: new Date() } });

    const sub = await prisma.pushSubscription.create({
      data: { user_id: mpdHeadId, endpoint: `https://push.example.test/${randomUUID()}`, p256dh: 'p256dh-key', auth: 'auth-key', device_label: 'test device' },
    });
    created.subscriptionIds.push(sub.id);
  });

  after(async () => {
    await prisma.notification.deleteMany({ where: { id: { in: created.notificationIds } } });
    await prisma.pushSubscription.deleteMany({ where: { id: { in: created.subscriptionIds } } });
    await prisma.notificationPreference.deleteMany({ where: { user_id: mpdHeadId } });
    if (originalPreference) await prisma.notificationPreference.create({ data: originalPreference });
    await prisma.$disconnect();
  });

  async function notify(title: string) {
    const ids = await createNotificationsForEvent(prisma, {
      eventKey: 'FINANCE_TARGET_CHANGED',
      title,
      body: 'Loss target updated.',
      deepLink: '/finance/reconciliation',
      dedupeSuffix: randomUUID(),
    });
    created.notificationIds.push(...ids);
    return ids;
  }

  const deliveryFor = async (userId: bigint, title: string) =>
    prisma.notificationDelivery.findFirstOrThrow({ where: { channel: 'PUSH', notification: { recipient_user_id: userId, title } } });

  test('sends to subscribed users and skips users with no device', async () => {
    const sent: PushMessage[] = [];
    const fake: PushSender = async (_target, message) => {
      sent.push(message);
    };
    const title = `Target changed ${randomUUID()}`;
    await notify(title);

    const summary = await processPushQueue({ send: fake });
    assert.ok(summary.sent >= 1);
    assert.equal(sent.filter((m) => m.title === title).length, 1);
    assert.equal(sent.find((m) => m.title === title)!.path, '/finance/reconciliation');
    assert.equal((await deliveryFor(mpdHeadId, title)).status, 'SENT');

    const skipped = await deliveryFor(financeId, title);
    assert.equal(skipped.status, 'SKIPPED');
    assert.equal(skipped.failure_reason, 'NO_SUBSCRIPTION');
  });

  test('defers routine alerts during quiet hours', async () => {
    const minute = plantMinutesOfDay(new Date());
    await prisma.notificationPreference.create({
      data: { user_id: mpdHeadId, push_enabled: true, delivery_mode: 'IMMEDIATE', quiet_hours_start: hhmm(minute - 60), quiet_hours_end: hhmm(minute + 60) },
    });
    try {
      const calls: string[] = [];
      const title = `Quiet ${randomUUID()}`;
      await notify(title);
      await processPushQueue({ send: async (_t, m) => void calls.push(m.title) });
      assert.equal(calls.includes(title), false);
      const delivery = await deliveryFor(mpdHeadId, title);
      assert.equal(delivery.status, 'QUEUED');
      assert.equal(delivery.attempt_count, 0);
    } finally {
      await prisma.notificationPreference.deleteMany({ where: { user_id: mpdHeadId } });
    }
  });

  test('skips everything when the user turned push off', async () => {
    await prisma.notificationPreference.create({ data: { user_id: mpdHeadId, push_enabled: false } });
    try {
      const title = `Disabled ${randomUUID()}`;
      await notify(title);
      await processPushQueue({ send: async () => assert.fail('must not send') });
      const delivery = await deliveryFor(mpdHeadId, title);
      assert.equal(delivery.status, 'SKIPPED');
      assert.equal(delivery.failure_reason, 'PUSH_DISABLED');
    } finally {
      await prisma.notificationPreference.deleteMany({ where: { user_id: mpdHeadId } });
    }
  });

  test('revokes a device the push service reports as gone and retries later', async () => {
    const title = `Gone ${randomUUID()}`;
    await notify(title);
    const gone: PushSender = async () => {
      throw Object.assign(new Error('Subscription has unsubscribed or expired.'), { statusCode: 410 });
    };
    await processPushQueue({ send: gone });

    const delivery = await deliveryFor(mpdHeadId, title);
    assert.equal(delivery.status, 'QUEUED');
    assert.equal(delivery.attempt_count, 1);
    assert.match(delivery.failure_reason || '', /HTTP 410/);
    const subscription = await prisma.pushSubscription.findUniqueOrThrow({ where: { id: created.subscriptionIds[0] } });
    assert.ok(subscription.revoked_at, 'subscription revoked');

    // With no active device left, the next run skips instead of retrying forever.
    await processPushQueue({ send: async () => assert.fail('must not send') });
    assert.equal((await deliveryFor(mpdHeadId, title)).failure_reason, 'NO_SUBSCRIPTION');
  });
});
