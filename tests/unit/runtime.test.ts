import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validateServerEnv } from '@core/env';
import { isSmsProviderConfigured, sendSms } from '@/backend/services/smsProvider';
import { GET as processSms } from '@/app/api/cron/process-sms/route';
import { fmtNum } from '@/frontend/modules/mpd/format';
import { withEnv } from '../helpers';

const GOOD_SECRET = 'a-perfectly-good-production-secret-of-sufficient-length';

describe('startup environment validation', () => {
  test('exits in production when JWT_SECRET is weak or a placeholder', async (t) => {
    const exit = t.mock.method(process, 'exit', (() => undefined) as never);
    t.mock.method(console, 'error', () => {});
    t.mock.method(console, 'warn', () => {});

    await withEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://x', JWT_SECRET: 'short' }, () => validateServerEnv());
    await withEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://x', JWT_SECRET: 'your-jwt-secret-key-at-least-32-chars-long' }, () => validateServerEnv());
    await withEnv({ NODE_ENV: 'production', DATABASE_URL: undefined, JWT_SECRET: GOOD_SECRET }, () => validateServerEnv());
    assert.equal(exit.mock.callCount(), 3);
    assert.deepEqual(exit.mock.calls[0].arguments, [1]);
  });

  test('accepts a valid production environment and only warns in development', async (t) => {
    const exit = t.mock.method(process, 'exit', (() => undefined) as never);
    const warn = t.mock.method(console, 'warn', () => {});

    await withEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://x', JWT_SECRET: GOOD_SECRET, ENABLE_DEMO_LOGIN: undefined, SESSION_COOKIE_SECURE: undefined }, () => validateServerEnv());
    await withEnv({ NODE_ENV: 'development', DATABASE_URL: undefined, JWT_SECRET: undefined }, () => validateServerEnv());
    assert.equal(exit.mock.callCount(), 0);
    assert.equal(warn.mock.callCount(), 1);
  });
});

describe('SMS gateway', () => {
  test('posts to the configured gateway with the bearer token and returns the message id', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
      new Response(JSON.stringify({ messageId: 'gw-123' }), { status: 200, headers: { 'content-type': 'application/json' } })
    );
    await withEnv({ SMS_PROVIDER_URL: 'https://sms.example/send', SMS_PROVIDER_TOKEN: 'tok', SMS_SENDER_ID: 'SFPL' }, async () => {
      assert.equal(isSmsProviderConfigured(), true);
      const result = await sendSms('+923001234567', 'Receipt 12.5 L');
      assert.equal(result.providerMessageId, 'gw-123');
    });
    const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, 'https://sms.example/send');
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer tok');
    assert.deepEqual(JSON.parse(String(init.body)), { to: '+923001234567', message: 'Receipt 12.5 L', sender: 'SFPL' });
  });

  test('fails loudly on gateway errors and when unconfigured', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('nope', { status: 502 }));
    await withEnv({ SMS_PROVIDER_URL: 'https://sms.example/send' }, async () => {
      await assert.rejects(sendSms('+92300', 'x'), /HTTP 502/);
    });
    await withEnv({ SMS_PROVIDER_URL: undefined }, async () => {
      assert.equal(isSmsProviderConfigured(), false);
      await assert.rejects(sendSms('+92300', 'x'), /not configured/);
    });
  });
});

describe('SMS cron endpoint', () => {
  const call = (auth?: string) =>
    processSms(new Request('http://plant.local/api/cron/process-sms', { headers: auth ? { authorization: auth } : {} }));

  test('is disabled without CRON_SECRET and rejects wrong secrets', async () => {
    await withEnv({ CRON_SECRET: undefined }, async () => assert.equal((await call('Bearer anything')).status, 503));
    await withEnv({ CRON_SECRET: 'right-secret' }, async () => {
      assert.equal((await call()).status, 401);
      assert.equal((await call('Bearer wrong-secret')).status, 401);
    });
  });

  test('leaves messages queued rather than faking delivery when no gateway is configured', async () => {
    await withEnv({ CRON_SECRET: 'right-secret', SMS_PROVIDER_URL: undefined }, async () => {
      const res = await call('Bearer right-secret');
      assert.equal(res.status, 200);
      assert.equal((await res.json()).skipped, true);
    });
  });
});

describe('dashboard number formatting', () => {
  test('renders missing data as a dash, never as zero', () => {
    assert.equal(fmtNum(null), '—');
    assert.equal(fmtNum(undefined, '%'), '—');
    assert.equal(fmtNum(Number.NaN), '—');
    assert.equal(fmtNum(0, ' L'), '0 L');
    assert.equal(fmtNum(4.25, '%'), '4.25%');
  });
});
