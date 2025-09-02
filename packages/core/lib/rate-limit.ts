// Simple rate limiter and replay cache.
// - Uses Redis (redis@^4) if REDIS_URL is set
// - Else uses Upstash Redis if UPSTASH_REDIS_REST_URL/TOKEN are set
// - Falls back to in-memory (development/single instance)

let provider: "node-redis" | "upstash" | "memory" | null = null;
let nodeRedis: any = null as any;
let upstashRedis: any = null as any;

async function initProvider() {
  if (provider) return provider;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const mod: any = await import("redis");
      const client = mod.createClient({ url: redisUrl });
      if (!client.isOpen) await client.connect();
      nodeRedis = client;
      provider = "node-redis";
      return provider;
    } catch {
      // fallthrough
    }
  }
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) {
    try {
      const mod = await import("@upstash/redis");
      upstashRedis = new (mod as any).Redis({ url: upstashUrl, token: upstashToken });
      provider = "upstash";
      return provider;
    } catch {
      // fallthrough
    }
  }
  provider = "memory";
  return provider;
}

// In-memory fallback
const buckets = new Map<string, number[]>();
const replayMem = new Map<string, Map<string, number>>();

export async function rateLimit(key: string, limit = 60, windowMs = 60_000, cost = 1) {
  const p = await initProvider();
  if (p === "node-redis") {
    const k = `rl:${key}`;
    const n = Number.isFinite(cost) && cost > 0 ? Math.floor(cost) : 1;
    const count = Number(await nodeRedis.incrBy(k, n));
    let pttl = Number(await nodeRedis.pTTL(k));
    if (pttl < 0) {
      await nodeRedis.pExpire(k, windowMs);
      pttl = windowMs;
    }
    if (count > limit) {
      const retryAfterMs = pttl > 0 ? pttl : windowMs;
      return {
        ok: false as const,
        retryAfterMs,
        resetAt: Date.now() + retryAfterMs,
        limit,
        remaining: 0,
      };
    }
    return {
      ok: true as const,
      remaining: Math.max(0, limit - count),
      resetAt: Date.now() + (pttl > 0 ? pttl : windowMs),
      limit,
    };
  }
  if (p === "upstash") {
    const k = `rl:${key}`;
    const n = Number.isFinite(cost) && cost > 0 ? Math.floor(cost) : 1;
    const count = (await (upstashRedis.incrby ? upstashRedis.incrby(k, n) : upstashRedis.incr(k))) as number;
    let pttl = (await upstashRedis.pttl(k)) as number;
    if (pttl < 0) {
      await upstashRedis.pexpire(k, windowMs);
      pttl = windowMs;
    }
    if (count > limit) {
      const retryAfterMs = pttl > 0 ? pttl : windowMs;
      return {
        ok: false as const,
        retryAfterMs,
        resetAt: Date.now() + retryAfterMs,
        limit,
        remaining: 0,
      };
    }
    return {
      ok: true as const,
      remaining: Math.max(0, limit - count),
      resetAt: Date.now() + (pttl > 0 ? pttl : windowMs),
      limit,
    };
  }

  const now = Date.now();
  const windowStart = now - windowMs;
  let arr = buckets.get(key);
  if (!arr) {
    arr = [];
    buckets.set(key, arr);
  }
  // prune
  while (arr.length && arr[0] < windowStart) arr.shift();
  if (arr.length >= limit) {
    const retryAfterMs = arr[0] + windowMs - now;
    return { ok: false as const, retryAfterMs, resetAt: Date.now() + retryAfterMs, limit, remaining: 0 };
  }
  // apply cost by pushing multiple timestamps (dev fallback only)
  const n = Number.isFinite(cost) && cost > 0 ? Math.floor(cost) : 1;
  for (let i = 0; i < n; i++) arr.push(now);
  return { ok: true as const, remaining: Math.max(0, limit - arr.length), resetAt: now + windowMs, limit };
}

export async function checkReplay(instanceId: string, signature: string, ttlMs = 60_000) {
  const p = await initProvider();
  if (p === "node-redis") {
    const k = `rp:${instanceId}:${signature}`;
    const set = await nodeRedis.set(k, "1", { NX: true, PX: ttlMs } as any);
    return set === "OK";
  }
  if (p === "upstash") {
    const k = `rp:${instanceId}:${signature}`;
    const res = await upstashRedis.set(k, "1", { nx: true, px: ttlMs });
    return res === "OK";
  }

  const now = Date.now();
  let sigs = replayMem.get(instanceId);
  if (!sigs) {
    sigs = new Map();
    replayMem.set(instanceId, sigs);
  }
  // purge expired
  for (const [sig, exp] of sigs.entries()) if (exp <= now) sigs.delete(sig);
  if (sigs.has(signature)) return false; // replay detected
  sigs.set(signature, now + ttlMs);
  return true;
}
