/**
 * lib/api/ratelimit — fixed-window rate limiter, 60 requests/min/principal.
 *
 * Single-process in-memory store: correct for the design-center topology
 * (one self-hosted Next.js instance serving a site). If the app is ever
 * scaled horizontally, swap this for a shared store (Postgres/Redis) —
 * the checkRateLimit() signature stays the same.
 *
 * Buckets evict themselves lazily on access; a periodic sweep keeps the
 * map bounded if many distinct keys hit once and never return.
 */

export const API_RATE_LIMIT = 60; // requests
export const API_RATE_WINDOW_MS = 60_000; // per minute

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();
const SWEEP_INTERVAL_MS = 5 * 60_000;
const MAX_BUCKETS = 10_000;
let lastSweep = Date.now();

function maybeSweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS && buckets.size <= MAX_BUCKETS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= API_RATE_WINDOW_MS) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfter: number;
}

export function checkRateLimit(principalKey: string, now = Date.now()): RateLimitResult {
  maybeSweep(now);
  const bucket = buckets.get(principalKey);
  if (!bucket || now - bucket.windowStart >= API_RATE_WINDOW_MS) {
    buckets.set(principalKey, { count: 1, windowStart: now });
    return {
      allowed: true,
      limit: API_RATE_LIMIT,
      remaining: API_RATE_LIMIT - 1,
      retryAfter: 0,
    };
  }
  bucket.count += 1;
  const retryAfter = Math.ceil((bucket.windowStart + API_RATE_WINDOW_MS - now) / 1000);
  return {
    allowed: bucket.count <= API_RATE_LIMIT,
    limit: API_RATE_LIMIT,
    remaining: Math.max(0, API_RATE_LIMIT - bucket.count),
    retryAfter,
  };
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfter) }),
  };
}
