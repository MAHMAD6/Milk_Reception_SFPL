/**
 * In-process fixed-window rate limiter.
 *
 * State lives in the Node.js process, so limits apply per application instance.
 * That is sufficient for the single-instance plant deployment; a multi-instance
 * deployment should front the app with a shared limiter (reverse proxy or Redis).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 50_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** Records one attempt against `key` and reports whether it is within `limit` per `windowMs`. */
export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (buckets.size > MAX_TRACKED_KEYS) sweep(now);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  return {
    allowed: bucket.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

/**
 * Best-effort client address. Only trusts X-Forwarded-For / X-Real-IP when
 * TRUST_PROXY=true, because those headers are client-controlled otherwise.
 */
export function getClientIp(req: Request): string {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
    const realIp = req.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;
  }
  return 'direct';
}
