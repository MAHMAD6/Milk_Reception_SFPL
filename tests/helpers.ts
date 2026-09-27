/** Test helpers. process.env.NODE_ENV is typed read-only by Next, so writes go through here. */
type EnvPatch = Record<string, string | undefined>;

export async function withEnv<T>(patch: EnvPatch, fn: () => T | Promise<T>): Promise<T> {
  const env = process.env as Record<string, string | undefined>;
  const previous: EnvPatch = {};
  for (const key of Object.keys(patch)) {
    previous[key] = env[key];
    if (patch[key] === undefined) delete env[key];
    else env[key] = patch[key];
  }
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(previous)) {
      if (previous[key] === undefined) delete env[key];
      else env[key] = previous[key];
    }
  }
}

export const TEST_JWT_SECRET = 'unit-test-jwt-secret-0123456789-abcdefghijklmnop';
