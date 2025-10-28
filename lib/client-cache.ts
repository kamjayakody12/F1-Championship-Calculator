/**
 * Client-Side Caching for React Components
 * 
 * Provides in-memory caching for API responses on the client side
 * to reduce unnecessary network requests and improve performance.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class ClientCache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();

  /**
   * Get data from cache or fetch if not available
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 60000 // Default 1 minute
  ): Promise<T> {
    // Check if data is in cache and not expired
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    // Check if there's already a pending request for this key
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending;
    }

    // Fetch new data
    const promise = fetcher()
      .then((data) => {
        // Store in cache
        this.cache.set(key, {
          data,
          timestamp: Date.now(),
          expiresAt: Date.now() + ttl
        });
        
        // Remove from pending
        this.pendingRequests.delete(key);
        
        return data;
      })
      .catch((error) => {
        // Remove from pending on error
        this.pendingRequests.delete(key);
        throw error;
      });

    // Store pending request
    this.pendingRequests.set(key, promise);

    return promise;
  }

  /**
   * Invalidate specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix
   */
  invalidatePrefix(prefix: string): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach((key) => {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      pending: this.pendingRequests.size,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        ttl: entry.expiresAt - Date.now()
      }))
    };
  }
}

// Export singleton
export const clientCache = new ClientCache();

/**
 * React hook for cached data fetching
 */
export function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    enabled?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const {
    ttl = 60000,
    enabled = true,
    onSuccess,
    onError
  } = options;

  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await clientCache.get(key, fetcher, ttl);
        
        if (!cancelled) {
          setData(result);
          onSuccess?.(result);
        }
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error('Unknown error');
          setError(error);
          onError?.(error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [key, enabled, ttl]);

  const refetch = React.useCallback(() => {
    clientCache.invalidate(key);
    setLoading(true);
    
    fetcher()
      .then((result) => {
        setData(result);
        onSuccess?.(result);
      })
      .catch((err) => {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        onError?.(error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [key, fetcher, onSuccess, onError]);

  return {
    data,
    loading,
    error,
    refetch
  };
}

// Need to import React for the hook
import React from 'react';
