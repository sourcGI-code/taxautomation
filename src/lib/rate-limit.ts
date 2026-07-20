/**
 * Production-grade rate limiter.
 * - Uses Upstash Redis REST when UPSTASH_REDIS_REST_URL + TOKEN are set (multi-instance safe)
 * - Falls back to in-memory buckets for local/single-instance
 */

type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let bucket = memoryBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    memoryBuckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return { ok: true };
}

/** Pure helper for tests — increments a provided map */
export function rateLimitInMemory(
  store: Map<string, Bucket>,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): RateLimitResult {
  let bucket = store.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { ok: true };
}

function hasUpstash(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

/**
 * Fixed-window counter via Upstash REST:
 * INCR key; if 1, EXPIRE key windowSec
 */
async function upstashRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const redisKey = `rl:${key}`;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));

  try {
    const incrRes = await fetch(`${base}/incr/${encodeURIComponent(redisKey)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!incrRes.ok) {
      return memoryRateLimit(key, limit, windowMs);
    }
    const incrJson = (await incrRes.json()) as { result?: number };
    const count = Number(incrJson.result ?? 0);

    if (count === 1) {
      await fetch(
        `${base}/expire/${encodeURIComponent(redisKey)}/${windowSec}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
    }

    if (count > limit) {
      // Best-effort TTL for retry-after
      let ttl = windowSec;
      try {
        const ttlRes = await fetch(
          `${base}/ttl/${encodeURIComponent(redisKey)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }
        );
        if (ttlRes.ok) {
          const ttlJson = (await ttlRes.json()) as { result?: number };
          if (typeof ttlJson.result === "number" && ttlJson.result > 0) {
            ttl = ttlJson.result;
          }
        }
      } catch {
        /* ignore */
      }
      return { ok: false, retryAfterSec: Math.max(1, ttl) };
    }

    return { ok: true };
  } catch {
    return memoryRateLimit(key, limit, windowMs);
  }
}

/**
 * Rate limit a key. Async so production can use Redis; memory fallback is sync-fast.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (hasUpstash()) {
    return upstashRateLimit(key, limit, windowMs);
  }
  return memoryRateLimit(key, limit, windowMs);
}

/** Sync alias for rare non-async paths — memory only */
export function rateLimitSync(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  return memoryRateLimit(key, limit, windowMs);
}

/** Best-effort client IP from common proxy headers */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export function rateLimitBackend(): "upstash" | "memory" {
  return hasUpstash() ? "upstash" : "memory";
}
