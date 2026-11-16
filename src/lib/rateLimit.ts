/**
 * Small in-memory, per-instance rate limiter for the AI endpoints (protects the
 * API budget from casual abuse). For multi-region production use a shared store
 * such as Upstash Redis.
 */
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(req: Request, name: string, max: number, windowMs: number): Response | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const key = `${name}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return null;
  }
  b.count++;
  if (b.count > max) {
    return new Response("Too many requests. Please wait a moment.", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((b.reset - now) / 1000)) },
    });
  }
  return null;
}
