import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { createSessionToken } from '@core/auth';
import { TEST_JWT_SECRET, withEnv } from '../helpers';

process.env.JWT_SECRET = TEST_JWT_SECRET;

const ORIGIN = 'http://plant.local';

function request(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`${ORIGIN}${path}`, { method: init.method || 'GET', headers: { host: 'plant.local', ...init.headers } });
}

const passedThrough = (res: Response) => res.headers.get('x-middleware-next') === '1';

describe('proxy: cross-origin API protection', () => {
  test('blocks a state-changing API call from another origin', async () => {
    const res = await proxy(request('/api/notifications', { method: 'POST', headers: { origin: 'https://evil.example' } }));
    assert.equal(res.status, 403);
  });

  test('blocks a cross-site request that omits Origin', async () => {
    const res = await proxy(request('/api/notifications', { method: 'PATCH', headers: { 'sec-fetch-site': 'cross-site' } }));
    assert.equal(res.status, 403);
  });

  test('allows same-origin writes, configured origins and safe methods', async () => {
    assert.ok(passedThrough(await proxy(request('/api/notifications', { method: 'POST', headers: { origin: ORIGIN } }))));
    assert.ok(passedThrough(await proxy(request('/api/notifications', { headers: { origin: 'https://evil.example' } }))));
    await withEnv({ APP_URL: 'https://milk.example.com' }, async () => {
      const res = await proxy(request('/api/notifications', { method: 'POST', headers: { origin: 'https://milk.example.com' } }));
      assert.ok(passedThrough(res));
    });
  });

  test('exempts secret-authenticated cron endpoints', async () => {
    const res = await proxy(request('/api/cron/process-sms', { method: 'POST', headers: { origin: 'https://scheduler.example' } }));
    assert.ok(passedThrough(res));
  });
});

describe('proxy: page protection', () => {
  test('redirects signed-out page loads to /login', async () => {
    const res = await proxy(request('/department/qa'));
    assert.equal(res.status, 307);
    assert.equal(new URL(res.headers.get('location')!).pathname, '/login');
  });

  test('leaves public pages alone', async () => {
    for (const path of ['/login', '/tv-board', '/workspace-unavailable']) {
      assert.ok(passedThrough(await proxy(request(path))), path);
    }
  });

  test('lets a valid session through and clears an invalid one', async () => {
    const token = await createSessionToken(
      { id: '1', username: 'u', name: 'U', role: 'QA_HEAD', department: 'QA' },
      false,
      '$2b$10$hash'
    );
    assert.ok(passedThrough(await proxy(request('/department/qa', { headers: { cookie: `auth_token=${token}` } }))));

    const res = await proxy(request('/department/qa', { headers: { cookie: 'auth_token=not-a-jwt' } }));
    assert.equal(res.status, 307);
    assert.match(res.headers.get('set-cookie') || '', /auth_token=;/);
  });
});

describe('proxy: security headers', () => {
  test('sets CSP and framing/sniffing protections on every response', async () => {
    const res = await proxy(request('/login'));
    const csp = res.headers.get('content-security-policy') || '';
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  test('adds HSTS only when cookies are secure (HTTPS deployments)', async () => {
    await withEnv({ NODE_ENV: 'production', SESSION_COOKIE_SECURE: undefined }, async () => {
      assert.ok((await proxy(request('/login'))).headers.get('strict-transport-security'));
    });
    await withEnv({ NODE_ENV: 'production', SESSION_COOKIE_SECURE: 'false' }, async () => {
      assert.equal((await proxy(request('/login'))).headers.get('strict-transport-security'), null);
    });
  });
});
