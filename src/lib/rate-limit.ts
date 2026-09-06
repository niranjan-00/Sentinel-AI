/** Simple in-memory sliding-window rate limiter (per server instance). */

interface Bucket {
  count: number;
  resetAt: number;
}

const globalForRate = globalThis as unknown as {
  __sentinelRateBuckets: Map<string, Bucket> | undefined;
};

const buckets: Map<string, Bucket> =
  globalForRate.__sentinelRateBuckets ?? new Map();
globalForRate.__sentinelRateBuckets = buckets;

/**
 * @returns true if the request is allowed, false if rate-limited.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

// occasional cleanup so the map does not grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
}, 60_000).unref?.();
