import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { createMotOfflinePreparationToken, createSessionToken } from '@core/auth';
import {
  SESSION_AUDIENCE,
  SESSION_ISSUER,
  fingerprintsMatch,
  getJwtSecretKey,
  isSecureCookie,
  passwordFingerprint,
  readSessionTokenFromCookieHeader,
  verifySessionJwt,
} from '@core/session';
import type { User } from '@core/types';
import { TEST_JWT_SECRET, withEnv } from '../helpers';

process.env.JWT_SECRET = TEST_JWT_SECRET;

const user: User = { id: '42', username: 'qa.chemist', name: 'QA Chemist', role: 'QA_LAB_ATTENDANT', department: 'QA' };
const PASSWORD_HASH = '$2b$10$abcdefghijklmnopqrstuuSomeBcryptHashValueForTests12345';

function base64url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('session tokens', () => {
  test('a freshly issued session verifies and carries the password fingerprint', async () => {
    const token = await createSessionToken(user, false, PASSWORD_HASH);
    const payload = await verifySessionJwt(token);
    assert.ok(payload);
    assert.equal(payload.id, '42');
    assert.equal(payload.sub, '42');
    assert.equal(payload.pwv, passwordFingerprint(PASSWORD_HASH));
  });

  test('remember-me sessions last 30 days, normal sessions 12 hours', async () => {
    const short = await verifySessionJwt(await createSessionToken(user, false, PASSWORD_HASH));
    const long = await verifySessionJwt(await createSessionToken(user, true, PASSWORD_HASH));
    assert.equal(short!.exp! - short!.iat!, 12 * 60 * 60);
    assert.equal(long!.exp! - long!.iat!, 30 * 24 * 60 * 60);
  });

  test('an MOT offline preparation receipt is never accepted as a session', async () => {
    const receipt = await createMotOfflinePreparationToken({
      userId: '42',
      journeyId: '1',
      zmccId: '1',
      expiresAt: new Date(Date.now() + 60_000),
    });
    assert.equal(await verifySessionJwt(receipt), null);
  });

  test('rejects tokens signed with another secret', async () => {
    const forged = await new SignJWT({ token_use: 'session', id: '1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(SESSION_ISSUER)
      .setAudience(SESSION_AUDIENCE)
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('some-other-secret-that-is-long-enough-000000'));
    assert.equal(await verifySessionJwt(forged), null);
  });

  test('rejects unsigned (alg: none) tokens', async () => {
    const unsigned = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
      token_use: 'session',
      id: '1',
      iss: SESSION_ISSUER,
      aud: SESSION_AUDIENCE,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })}.`;
    assert.equal(await verifySessionJwt(unsigned), null);
  });

  test('rejects expired tokens and legacy tokens without token_use', async () => {
    const key = getJwtSecretKey();
    const expired = await new SignJWT({ token_use: 'session', id: '1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(SESSION_ISSUER)
      .setAudience(SESSION_AUDIENCE)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);
    const legacy = await new SignJWT({ id: '1', role: 'SUPER_ADMIN' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(key);
    assert.equal(await verifySessionJwt(expired), null);
    assert.equal(await verifySessionJwt(legacy), null);
  });
});

describe('password fingerprint', () => {
  test('changes whenever the password hash changes', () => {
    const a = passwordFingerprint('$2b$10$hash-one');
    const b = passwordFingerprint('$2b$10$hash-two');
    assert.notEqual(a, b);
    assert.equal(a, passwordFingerprint('$2b$10$hash-one'));
  });

  test('fingerprintsMatch only accepts an identical string', () => {
    const fp = passwordFingerprint('x');
    assert.equal(fingerprintsMatch(fp, fp), true);
    assert.equal(fingerprintsMatch(fp, passwordFingerprint('y')), false);
    assert.equal(fingerprintsMatch(fp, fp.slice(1)), false);
    assert.equal(fingerprintsMatch(fp, undefined), false);
    assert.equal(fingerprintsMatch(fp, 123), false);
  });
});

describe('cookie parsing', () => {
  test('reads the exact auth_token cookie', () => {
    assert.equal(readSessionTokenFromCookieHeader('theme=dark; auth_token=abc.def.ghi; other=1'), 'abc.def.ghi');
    assert.equal(readSessionTokenFromCookieHeader('auth_token=a%2Eb'), 'a.b');
  });

  test('ignores look-alike cookie names and empty or malformed values', () => {
    assert.equal(readSessionTokenFromCookieHeader('x_auth_token=evil'), null);
    assert.equal(readSessionTokenFromCookieHeader('auth_token_old=evil'), null);
    assert.equal(readSessionTokenFromCookieHeader('auth_token='), null);
    assert.equal(readSessionTokenFromCookieHeader('auth_token=%E0%A4%A'), null);
    assert.equal(readSessionTokenFromCookieHeader(null), null);
  });
});

describe('secret and cookie configuration', () => {
  test('production rejects a short JWT_SECRET; development tolerates it', async () => {
    await withEnv({ NODE_ENV: 'production', JWT_SECRET: 'short' }, () => {
      assert.throws(() => getJwtSecretKey(), /at least 32 characters/);
    });
    await withEnv({ NODE_ENV: 'development', JWT_SECRET: 'short' }, () => {
      assert.ok(getJwtSecretKey());
    });
    await withEnv({ JWT_SECRET: '   ' }, () => {
      assert.throws(() => getJwtSecretKey(), /missing or empty/);
    });
  });

  test('secure cookies default on in production and can be overridden', async () => {
    await withEnv({ NODE_ENV: 'production', SESSION_COOKIE_SECURE: undefined }, () => assert.equal(isSecureCookie(), true));
    await withEnv({ NODE_ENV: 'production', SESSION_COOKIE_SECURE: 'false' }, () => assert.equal(isSecureCookie(), false));
    await withEnv({ NODE_ENV: 'development', SESSION_COOKIE_SECURE: undefined }, () => assert.equal(isSecureCookie(), false));
    await withEnv({ NODE_ENV: 'development', SESSION_COOKIE_SECURE: 'true' }, () => assert.equal(isSecureCookie(), true));
  });
});
