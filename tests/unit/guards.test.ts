import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { errorResponse, isInternalError, safeErrorMessage } from '@core/apiGuard';
import { ROLE_GROUPS, roleIn } from '@core/roleGroups';
import { isDemoLoginEnabled } from '@core/demoLogin';
import { consumeRateLimit, getClientIp, resetRateLimit } from '@core/rateLimit';
import { resolveRoleHome, roleGateRedirect } from '@/lib/role-routing';
import { parseGovernanceOverrideId } from '@/backend/services/governanceOverrideService';
import { withEnv } from '../helpers';

function namedError(name: string, message: string, code?: string) {
  const err = new Error(message) as Error & { code?: string };
  err.name = name;
  if (code) err.code = code;
  return err;
}

describe('API error sanitization', () => {
  test('treats database, driver and runtime errors as internal', () => {
    assert.equal(isInternalError(namedError('PrismaClientKnownRequestError', 'Unique constraint on users_pkey', 'P2002')), true);
    assert.equal(isInternalError(namedError('PrismaClientValidationError', 'Invalid `prisma.user.findMany()`')), true);
    assert.equal(isInternalError(new TypeError("Cannot read properties of undefined (reading 'id')")), true);
    assert.equal(isInternalError(namedError('Error', 'duplicate key value', '23505')), true);
    assert.equal(isInternalError(namedError('Error', 'connect ECONNREFUSED 10.0.0.5:5432', 'ECONNREFUSED')), true);
    assert.equal(isInternalError('a string'), true);
  });

  test('keeps deliberate business-rule messages', () => {
    assert.equal(isInternalError(new Error('Silo capacity exceeded.')), false);
    assert.equal(isInternalError(namedError('QuantityMeasurementError', 'Quantity value is required.', 'QUANTITY_VALUE_REQUIRED')), false);
    assert.equal(safeErrorMessage(new Error('Silo capacity exceeded.'), 'fallback'), 'Silo capacity exceeded.');
  });

  test('replaces internal or oversized messages with the fallback', () => {
    assert.equal(safeErrorMessage(namedError('PrismaClientKnownRequestError', 'SELECT * FROM users', 'P2025'), 'Try again.'), 'Try again.');
    assert.equal(safeErrorMessage(new Error('x'.repeat(501)), 'Try again.'), 'Try again.');
    assert.equal(safeErrorMessage(new Error(''), 'Try again.'), 'Try again.');
  });

  test('errorResponse logs server-side and returns a sanitized body', async (t) => {
    const logged = t.mock.method(console, 'error', () => {});
    const res = errorResponse('CTX', new TypeError('secret internals'), 'Failed.', 500);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: 'Failed.' });
    assert.equal(logged.mock.callCount(), 1);
  });
});

describe('role groups and page gates', () => {
  test('roleIn matches only listed roles', () => {
    assert.equal(roleIn('QA_HEAD', ROLE_GROUPS.PLANT_QA), true);
    assert.equal(roleIn('MOT', ROLE_GROUPS.PLANT_QA), false);
    assert.equal(roleIn(undefined, ROLE_GROUPS.PLANT_QA), false);
  });

  test('operational field roles are neither source-scoped readers nor system-wide readers', () => {
    for (const role of ['MOT', 'WEIGHBRIDGE_OPERATOR', 'QA_LAB_ATTENDANT', 'SECURITY_OPERATOR', 'PRODUCTION_RECEPTION_OPERATOR']) {
      assert.equal(roleIn(role, ROLE_GROUPS.SOURCE_SCOPED_READERS), false, role);
      assert.equal(roleIn(role, ROLE_GROUPS.SYSTEM_WIDE_READERS), false, role);
    }
  });

  test('roleGateRedirect sends signed-out users to login and other roles home', () => {
    assert.equal(roleGateRedirect(null, ['QA_HEAD']), '/login');
    assert.equal(roleGateRedirect({ role: 'QA_HEAD' }, ['QA_HEAD']), null);
    assert.equal(roleGateRedirect({ role: 'MOT' }, ['QA_HEAD']), resolveRoleHome('MOT'));
    assert.equal(roleGateRedirect({ role: 42 }, ['QA_HEAD']), '/workspace-unavailable');
  });
});

describe('demo login flag', () => {
  test('is on only under next dev or with an explicit opt-in', async () => {
    await withEnv({ NODE_ENV: 'production', ENABLE_DEMO_LOGIN: undefined }, () => assert.equal(isDemoLoginEnabled(), false));
    await withEnv({ NODE_ENV: 'production', ENABLE_DEMO_LOGIN: 'true' }, () => assert.equal(isDemoLoginEnabled(), true));
    await withEnv({ NODE_ENV: 'development', ENABLE_DEMO_LOGIN: undefined }, () => assert.equal(isDemoLoginEnabled(), true));
    await withEnv({ NODE_ENV: 'development', ENABLE_DEMO_LOGIN: 'false' }, () => assert.equal(isDemoLoginEnabled(), false));
    await withEnv({ NODE_ENV: 'test', ENABLE_DEMO_LOGIN: undefined }, () => assert.equal(isDemoLoginEnabled(), false));
  });
});

describe('rate limiter', () => {
  test('allows up to the limit, then blocks until reset', () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) assert.equal(consumeRateLimit(key, 3, 60_000).allowed, true);
    const blocked = consumeRateLimit(key, 3, 60_000);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds > 0 && blocked.retryAfterSeconds <= 60);
    resetRateLimit(key);
    assert.equal(consumeRateLimit(key, 3, 60_000).allowed, true);
  });

  test('a new window starts after the old one expires', async () => {
    const key = `test:${Math.random()}`;
    consumeRateLimit(key, 1, 20);
    assert.equal(consumeRateLimit(key, 1, 20).allowed, false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(consumeRateLimit(key, 1, 20).allowed, true);
  });

  test('only trusts forwarding headers behind a declared proxy', async () => {
    const req = new Request('http://app.local/api/auth/login', {
      headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1', 'x-real-ip': '198.51.100.7' },
    });
    await withEnv({ TRUST_PROXY: undefined }, () => assert.equal(getClientIp(req), 'direct'));
    await withEnv({ TRUST_PROXY: 'true' }, () => assert.equal(getClientIp(req), '203.0.113.9'));
  });
});

describe('governance override ids', () => {
  test('accepts only ZMCC lab session and plant portion ids', () => {
    assert.deepEqual(parseGovernanceOverrideId('ZLS-12'), { table: 'zmcc_lab_session', recordId: BigInt(12) });
    assert.deepEqual(parseGovernanceOverrideId(' VP-7 '), { table: 'visit_portion', recordId: BigInt(7) });
    for (const bad of ['OVR-001', 'ZLS-', 'ZLS-12a', 'XX-1', 'ZLS-1234567890123456789', 12, null]) {
      assert.equal(parseGovernanceOverrideId(bad), null, String(bad));
    }
  });
});
