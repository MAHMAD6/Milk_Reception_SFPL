/**
 * Route-handler integration tests against a migrated and seeded database
 * (`npx prisma db seed` in development mode). Skipped when DATABASE_URL is unset.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@core/db';
import { POST as login } from '@/app/api/auth/login/route';
import { GET as me } from '@/app/api/auth/me/route';
import { GET as logs } from '@/app/api/logs/route';
import { GET as dispatches } from '@/app/api/dispatches/route';
import { GET as qaQueues } from '@/app/api/qa/sessions/queues/route';
import { GET as unloadingQueue } from '@/app/api/production/unloading-queue/route';
import { GET as labTests } from '@/app/api/lab-tests/route';
import { POST as revalidate } from '@/app/api/revalidate/route';
import { TEST_JWT_SECRET } from '../helpers';

const hasDatabase = Boolean(process.env.DATABASE_URL);
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = TEST_JWT_SECRET;

const BASE = 'http://plant.local';

async function signIn(username: string, password: string) {
  const res = await login(
    new NextRequest(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  );
  const cookie = res.headers.get('set-cookie')?.split(';')[0] || '';
  return { res, cookie };
}

function get(path: string, cookie = '') {
  return new NextRequest(`${BASE}${path}`, { headers: cookie ? { cookie } : {} });
}

describe('authentication and authorization (database)', { skip: !hasDatabase && 'DATABASE_URL not set' }, () => {
  const sessions: Record<string, string> = {};

  before(async () => {
    for (const [username, password] of [
      ['qa.chemist', 'qa123'],
      ['mot.driver', 'mot123'],
      ['contractor.operator.alkhair', 'mpd123'],
      ['production.operator', 'production123'],
      ['mpd.head', 'mpdhead123'],
    ]) {
      const { res, cookie } = await signIn(username, password);
      assert.equal(res.status, 200, `seeded demo account ${username} must sign in`);
      sessions[username] = cookie;
    }
  });

  after(async () => {
    await prisma.$disconnect();
  });

  test('sign-in failures are indistinguishable (no account enumeration)', async () => {
    const wrongPassword = await signIn('qa.chemist', 'definitely-wrong');
    const unknownUser = await signIn('no.such.user', 'whatever');
    const deactivated = await signIn('super.admin', 'admin123'); // seeded inactive account
    for (const { res } of [wrongPassword, unknownUser, deactivated]) {
      assert.equal(res.status, 401);
      assert.deepEqual(await res.json(), { error: 'Invalid username or password' });
      assert.equal(res.headers.get('set-cookie'), null);
    }
  });

  test('session cookie is HttpOnly and SameSite', async () => {
    const { res } = await signIn('qa.chemist', 'qa123');
    const cookie = res.headers.get('set-cookie') || '';
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=lax/i);
  });

  test('anonymous callers are refused', async () => {
    assert.equal((await me(get('/api/auth/me'))).status, 401);
    assert.equal((await logs(get('/api/logs'))).status, 401);
    assert.equal((await labTests(get('/api/lab-tests'))).status, 401);
    const res = await revalidate(new NextRequest(`${BASE}/api/revalidate`, { method: 'POST', body: '{"path":"/"}' }));
    assert.equal(res.status, 401);
  });

  test('field roles cannot read plant-wide or cross-source records', async () => {
    const mot = sessions['mot.driver'];
    assert.equal((await logs(get('/api/logs', mot))).status, 403);
    assert.equal((await dispatches(get('/api/dispatches', mot))).status, 403);
    assert.equal((await qaQueues(get('/api/qa/sessions/queues', mot))).status, 403);
    assert.equal((await unloadingQueue(get('/api/production/unloading-queue', mot))).status, 403);
    assert.equal((await qaQueues(get('/api/qa/sessions/queues', sessions['contractor.operator.alkhair']))).status, 403);
  });

  test('legitimate roles keep access', async () => {
    assert.equal((await qaQueues(get('/api/qa/sessions/queues', sessions['qa.chemist']))).status, 200);
    assert.equal((await unloadingQueue(get('/api/production/unloading-queue', sessions['production.operator']))).status, 200);
    assert.equal((await logs(get('/api/logs', sessions['mpd.head']))).status, 200);
    assert.equal((await logs(get('/api/logs', sessions['contractor.operator.alkhair']))).status, 200);
    assert.equal((await dispatches(get('/api/dispatches', sessions['contractor.operator.alkhair']))).status, 200);
  });

  test('contractor log reads stay within their own procurement source', async () => {
    const contractor = await prisma.user.findUnique({ where: { username: 'contractor.operator.alkhair' } });
    const res = await logs(get('/api/logs?mode=report&fromDate=2020-01-01&toDate=2099-12-31&pageSize=100', sessions['contractor.operator.alkhair']));
    const body = await res.json();
    const source = await prisma.procurementSource.findUnique({ where: { id: contractor!.procurement_source_id! } });
    const items = body.items as Array<{ zonal_contractor_name: string }>;
    assert.ok(items.length > 0, 'seed data must include a visit for the contractor');
    for (const item of items) assert.equal(item.zonal_contractor_name, source!.name);

    // The seed spans several sources, so an unscoped reader sees more than one.
    const all = await (await logs(get('/api/logs?mode=report&fromDate=2020-01-01&toDate=2099-12-31&pageSize=100', sessions['mpd.head']))).json();
    const names = new Set((all.items as Array<{ zonal_contractor_name: string }>).map((item) => item.zonal_contractor_name));
    assert.ok(names.size > 1, 'system-wide readers see every source');
  });

  test('changing a password revokes existing sessions', async () => {
    const cookie = sessions['qa.chemist'];
    assert.equal((await me(get('/api/auth/me', cookie))).status, 200);

    const user = await prisma.user.findUnique({ where: { username: 'qa.chemist' } });
    const originalHash = user!.password_hash!;
    try {
      await prisma.user.update({ where: { id: user!.id }, data: { password_hash: await bcrypt.hash('rotated-password', 4) } });
      assert.equal((await me(get('/api/auth/me', cookie))).status, 401);
    } finally {
      await prisma.user.update({ where: { id: user!.id }, data: { password_hash: originalHash } });
    }
  });

  test('deactivating an account ends its sessions immediately', async () => {
    const cookie = sessions['production.operator'];
    const user = await prisma.user.findUnique({ where: { username: 'production.operator' } });
    try {
      await prisma.user.update({ where: { id: user!.id }, data: { is_active: false } });
      assert.equal((await me(get('/api/auth/me', cookie))).status, 401);
    } finally {
      await prisma.user.update({ where: { id: user!.id }, data: { is_active: true } });
    }
  });
});
