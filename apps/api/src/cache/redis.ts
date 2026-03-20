import pino from "pino";

const logger = pino({ name: "cache" });

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
interface CacheDriver {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

// ────────────────────────────────────────────────────────────
// In-memory fallback
// ────────────────────────────────────────────────────────────
class MemoryCache implements CacheDriver {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// ────────────────────────────────────────────────────────────
// Upstash Redis driver (lazy-loaded)
// ────────────────────────────────────────────────────────────
class UpstashCache implements CacheDriver {
  private client: {
    get: (key: string) => Promise<string | null>;
    set: (
      key: string,
      value: string,
      opts: { ex: number }
    ) => Promise<unknown>;
    del: (key: string) => Promise<unknown>;
  } | null = null;

  private async getClient() {
    if (this.client) return this.client;
    // Dynamic import to avoid crashing if package is not installed
    const { Redis } = await import("@upstash/redis");
    this.client = new Redis({
      url: process.env["UPSTASH_REDIS_REST_URL"]!,
      token: process.env["UPSTASH_REDIS_REST_TOKEN"]!,
    }) as unknown as typeof this.client;
    return this.client!;
  }

  async get(key: string): Promise<string | null> {
    const c = await this.getClient();
    return c!.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const c = await this.getClient();
    await c!.set(key, value, { ex: ttlSeconds });
  }

  async del(key: string): Promise<void> {
    const c = await this.getClient();
    await c!.del(key);
  }
}

// ────────────────────────────────────────────────────────────
// Factory: pick driver based on env vars
// ────────────────────────────────────────────────────────────
function buildDriver(): CacheDriver {
  const url = process.env["UPSTASH_REDIS_REST_URL"];
  const token = process.env["UPSTASH_REDIS_REST_TOKEN"];
  if (url && token) {
    logger.info("Using Upstash Redis cache");
    return new UpstashCache();
  }
  logger.warn("UPSTASH env vars not set — using in-memory cache fallback");
  return new MemoryCache();
}

const driver = buildDriver();

// ────────────────────────────────────────────────────────────
// TTL constants (seconds)
// ────────────────────────────────────────────────────────────
export const TTL = {
  AVAILABILITY: 60 * 60 * 12, // 12 hours
  RATINGS: 60 * 60 * 24, // 24 hours
  SEARCH: 60 * 60 * 1, // 1 hour
  DISCOVER: 60 * 60 * 6, // 6 hours
} as const;

// ────────────────────────────────────────────────────────────
// Cache-aside helper
// ────────────────────────────────────────────────────────────
export async function cacheAside<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const cached = await driver.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    logger.error({ err, key }, "Cache read error");
  }

  const value = await fetcher();

  try {
    await driver.set(key, JSON.stringify(value), ttl);
  } catch (err) {
    logger.error({ err, key }, "Cache write error");
  }

  return value;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await driver.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.error({ err, key }, "Cache get error");
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttl: number
): Promise<void> {
  try {
    await driver.set(key, JSON.stringify(value), ttl);
  } catch (err) {
    logger.error({ err, key }, "Cache set error");
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await driver.del(key);
  } catch (err) {
    logger.error({ err, key }, "Cache del error");
  }
}
