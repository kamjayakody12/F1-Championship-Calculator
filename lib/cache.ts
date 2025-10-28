/**
 * Enhanced Caching System for F1 Championship App
 * 
 * Features:
 * - TTL-based expiration
 * - Prefix-based invalidation
 * - Memory management with size limits
 * - Cache statistics for monitoring
 * - Stale-while-revalidate support
 */

type Milliseconds = number;

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
  size: number; // Approximate size in bytes
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hits: number;
  misses: number;
  evictions: number;
}

/**
 * Enhanced TTL Cache with memory management and statistics
 */
class EnhancedTTLCache {
  private store = new Map<string, CacheEntry>();
  private stats: CacheStats = {
    totalEntries: 0,
    totalSize: 0,
    hits: 0,
    misses: 0,
    evictions: 0
  };
  
  // Configuration
  private readonly MAX_SIZE = 50 * 1024 * 1024; // 50MB max cache size
  private readonly MAX_ENTRIES = 1000; // Max number of entries
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // Cleanup every 5 minutes
  
  constructor() {
    // Periodic cleanup of expired entries
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    }
  }

  /**
   * Get value from cache
   * Returns undefined if not found or expired
   */
  get<T = unknown>(key: string): T | undefined {
    const entry = this.store.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.totalSize -= entry.size;
      this.stats.totalEntries--;
      this.stats.misses++;
      return undefined;
    }
    
    // Update hit count
    entry.hits++;
    this.stats.hits++;
    
    return entry.value as T;
  }

  /**
   * Set value in cache with TTL
   * Automatically manages memory by evicting old entries if needed
   */
  set<T = unknown>(key: string, value: T, ttlMs: Milliseconds): void {
    // Calculate approximate size
    const size = this.estimateSize(value);
    
    // Check if we need to evict entries
    if (this.stats.totalSize + size > this.MAX_SIZE || this.store.size >= this.MAX_ENTRIES) {
      this.evictLRU();
    }
    
    // Remove old entry if exists
    const oldEntry = this.store.get(key);
    if (oldEntry) {
      this.stats.totalSize -= oldEntry.size;
      this.stats.totalEntries--;
    }
    
    // Add new entry
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
      hits: 0,
      size
    });
    
    this.stats.totalSize += size;
    this.stats.totalEntries++;
  }

  /**
   * Delete specific key from cache
   */
  del(key: string): void {
    const entry = this.store.get(key);
    if (entry) {
      this.stats.totalSize -= entry.size;
      this.stats.totalEntries--;
    }
    this.store.delete(key);
  }

  /**
   * Delete all keys with given prefix
   * Useful for invalidating related caches (e.g., all results caches)
   */
  delByPrefix(prefix: string): void {
    const keys = Array.from(this.store.keys());
    keys.forEach((k) => {
      if (k.startsWith(prefix)) {
        const entry = this.store.get(k);
        if (entry) {
          this.stats.totalSize -= entry.size;
          this.stats.totalEntries--;
        }
        this.store.delete(k);
      }
    });
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.store.clear();
    this.stats.totalEntries = 0;
    this.stats.totalSize = 0;
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keys = Array.from(this.store.keys());
    
    keys.forEach((key) => {
      const entry = this.store.get(key);
      if (entry && now > entry.expiresAt) {
        this.stats.totalSize -= entry.size;
        this.stats.totalEntries--;
        this.store.delete(key);
      }
    });
  }

  /**
   * Evict least recently used entries when cache is full
   */
  private evictLRU(): void {
    // Sort entries by hits (least used first)
    const entries = Array.from(this.store.entries())
      .sort((a, b) => a[1].hits - b[1].hits);
    
    // Remove bottom 10% of entries
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
    
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const [key, entry] = entries[i];
      this.stats.totalSize -= entry.size;
      this.stats.totalEntries--;
      this.stats.evictions++;
      this.store.delete(key);
    }
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: unknown): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default 1KB if can't stringify
    }
  }
}

// Export singleton instance
export const apiCache = new EnhancedTTLCache();

/**
 * Cache duration constants for different data types
 * Adjust these based on how frequently data changes
 */
export const CACHE_DURATIONS = {
  // Static data (rarely changes)
  TRACKS: 5 * 60 * 1000,           // 5 minutes
  TEAMS: 2 * 60 * 1000,             // 2 minutes
  DRIVERS: 60 * 1000,               // 1 minute
  RULES: 5 * 60 * 1000,             // 5 minutes
  
  // Dynamic data (changes frequently)
  RESULTS: 30 * 1000,               // 30 seconds
  STANDINGS: 30 * 1000,             // 30 seconds
  QUALIFYING: 30 * 1000,            // 30 seconds
  
  // Computed data (expensive to calculate)
  DRIVER_STATS: 60 * 1000,          // 1 minute
  CONSTRUCTOR_STANDINGS: 60 * 1000, // 1 minute
  
  // Schedule data
  SCHEDULES: 2 * 60 * 1000,         // 2 minutes
  SELECTED_TRACKS: 2 * 60 * 1000,   // 2 minutes
} as const;

/**
 * HTTP Cache-Control headers for different scenarios
 */
export function withCacheControlHeaders(
  init?: ResponseInit,
  options?: {
    maxAge?: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
    mustRevalidate?: boolean;
  }
): ResponseInit {
  const headers = new Headers(init?.headers);
  
  if (!headers.has('Cache-Control')) {
    const {
      maxAge = 0,
      sMaxAge = 60,
      staleWhileRevalidate = 600,
      mustRevalidate = false
    } = options || {};
    
    const directives = [
      'public',
      `max-age=${maxAge}`,
      `s-maxage=${sMaxAge}`,
      `stale-while-revalidate=${staleWhileRevalidate}`
    ];
    
    if (mustRevalidate) {
      directives.push('must-revalidate');
    }
    
    headers.set('Cache-Control', directives.join(', '));
  }
  
  // Add ETag for conditional requests (optional)
  if (!headers.has('ETag')) {
    const etag = `"${Date.now()}"`;
    headers.set('ETag', etag);
  }
  
  return { ...init, headers };
}

/**
 * Preset cache control configurations
 */
export const CACHE_PRESETS = {
  // Static data - cache aggressively
  STATIC: {
    maxAge: 300,      // 5 minutes browser cache
    sMaxAge: 3600,    // 1 hour CDN cache
    staleWhileRevalidate: 86400 // 24 hours stale
  },
  
  // Dynamic data - short cache with revalidation
  DYNAMIC: {
    maxAge: 0,        // No browser cache
    sMaxAge: 30,      // 30 seconds CDN cache
    staleWhileRevalidate: 300 // 5 minutes stale
  },
  
  // Real-time data - minimal caching
  REALTIME: {
    maxAge: 0,
    sMaxAge: 5,       // 5 seconds CDN cache
    staleWhileRevalidate: 60 // 1 minute stale
  },
  
  // No cache - always fresh
  NO_CACHE: {
    maxAge: 0,
    sMaxAge: 0,
    staleWhileRevalidate: 0,
    mustRevalidate: true
  }
} as const;


