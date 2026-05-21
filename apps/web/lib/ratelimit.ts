import Redis from "ioredis";

// Single shared Redis client. REDIS_URL is injected by the kuso Redis
// addon. If it is missing, `redis` stays null and rate limiting is
// disabled (fail-open) — a limiter outage must not break the app.
let redis: Redis | null = null;
if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
  } catch {
    redis = null;
  }
}

// rateLimit increments a fixed-window counter for `key` and reports
// whether the caller is still under `limit` requests per `windowSec`.
// Fails OPEN on any Redis error.
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  if (!redis) return true;
  try {
    const fullKey = `ratelimit:web:${key}`;
    const results = await redis
      .multi()
      .incr(fullKey)
      .expire(fullKey, windowSec)
      .exec();
    const count = results?.[0]?.[1];
    if (typeof count !== "number") return true;
    return count <= limit;
  } catch {
    return true;
  }
}
