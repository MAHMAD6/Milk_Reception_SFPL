/** Non-admin reads are always ZMCC-scoped; fail closed if the scope is somehow missing. */
export function requireZmccScope(auth: { effectiveZmccId: bigint | null }): bigint {
  if (auth.effectiveZmccId == null) {
    throw new Error('ZMCC scope is required for non-admin access.');
  }
  return auth.effectiveZmccId;
}
