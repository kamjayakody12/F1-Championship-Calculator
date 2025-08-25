type Milliseconds = number;

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

class SimpleTTLCache {
  private store = new Map<string, CacheEntry>();

  get<T = unknown>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T = unknown>(key: string, value: T, ttlMs: Milliseconds): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  delByPrefix(prefix: string): void {
    const keys = Array.from(this.store.keys());
    keys.forEach((k) => {
      if (k.startsWith(prefix)) this.store.delete(k);
    });
  }

  clear(): void {
    this.store.clear();
  }
}

export const apiCache = new SimpleTTLCache();

export function withCacheControlHeaders(init?: ResponseInit): ResponseInit {
  const headers = new Headers(init?.headers);
  // Short-lived caching with stale-while-revalidate to keep UI snappy
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
  }
  return { ...init, headers };
}


