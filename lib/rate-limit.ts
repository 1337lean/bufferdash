type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
let requestsSinceCleanup = 0;

function removeExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  requestsSinceCleanup += 1;
  if (requestsSinceCleanup >= 1_000 || buckets.size >= 10_000) {
    removeExpiredBuckets(now);
    requestsSinceCleanup = 0;
  }
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: now + windowMs };
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt
  };
}
