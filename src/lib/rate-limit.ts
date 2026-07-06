/**
 * Minimal in-memory fixed-window rate limiter. SERVER ONLY.
 *
 * This is a lightweight, zero-infrastructure guard for the public endpoints
 * (invite view/submit, partner signup). It lives in module memory, so on
 * serverless it only limits within a single warm instance — good enough to blunt
 * a naive flood and cap abuse/cost, but NOT a distributed limiter. If you need
 * hard guarantees across instances, move this to Upstash/Redis or Vercel's WAF
 * rate-limit rules; the call sites stay the same.
 */
import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the map can't grow unbounded.
function prune(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
}

export type RateLimitResult = { ok: boolean; retryAfterMs: number };

/**
 * Record a hit for `key`. Allows up to `limit` hits per `windowMs` window.
 * Returns `{ ok: false }` (and the remaining wait) once the limit is exceeded.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  prune(now);

  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterMs: b.resetAt - now };
  }
  b.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

/** Best-effort client IP from the proxy headers (falls back to "unknown"). */
export function clientIp(): string {
  const h = headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}
