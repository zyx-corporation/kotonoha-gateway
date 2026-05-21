/**
 * Per-API-key request throttle (simple fixed window).
 */

type Window = { count: number; windowStartMs: number };

const buckets = new Map<string, Window>();

export function checkRateLimit(
  key: string,
  limitPerMinute: number,
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const windowMs = 60_000;
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStartMs >= windowMs) {
    bucket = { count: 0, windowStartMs: now };
    buckets.set(key, bucket);
  }
  if (bucket.count >= limitPerMinute) {
    const retryAfterSec = Math.ceil(
      (windowMs - (now - bucket.windowStartMs)) / 1000,
    );
    return { allowed: false, retryAfterSec };
  }
  bucket.count += 1;
  return { allowed: true };
}

/** Test helper */
export function resetRateLimitBuckets(): void {
  buckets.clear();
}
