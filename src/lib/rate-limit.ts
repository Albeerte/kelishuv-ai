import "server-only";
import Redis from "ioredis";
const state = globalThis as typeof globalThis & {
  mmRedis?: Redis;
  mmLocalLimits?: Map<string, { count: number; expires: number }>;
};
export async function withinRateLimit(
  key: string,
  maximum: number,
): Promise<boolean> {
  if (process.env.REDIS_URL) {
    if (!state.mmRedis) {
      state.mmRedis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        retryStrategy: () => null,
      });
      state.mmRedis.on("error", () => undefined);
    }
    const redis = state.mmRedis;
    try {
      const results = await redis
        .multi()
        .incr(`medimatch:limit:${key}`)
        .expire(`medimatch:limit:${key}`, 60, "NX")
        .exec();
      if (results && !results[0][0]) return Number(results[0][1]) <= maximum;
    } catch {
      /* The local limiter keeps single-process development available. */
    }
  }
  const limits = (state.mmLocalLimits ??= new Map());
  const now = Date.now();
  for (const [id, item] of limits) if (item.expires < now) limits.delete(id);
  const item = limits.get(key) || { count: 0, expires: now + 60000 };
  item.count += 1;
  limits.set(key, item);
  return item.count <= maximum;
}
