/**
 * lib/cache.ts — 模块10：数据能力进阶
 *
 * 内存缓存层，支持：
 * - TTL（生存时间）自动过期
 * - 缓存穿透防护（空值占位）
 * - 定期清理
 * - 缓存统计
 */

const NULL_PLACEHOLDER = Symbol('__CACHE_NULL__');

interface CacheEntry<T> {
  data: T | typeof NULL_PLACEHOLDER;
  expiresAt: number;
  hits: number;
}

interface CacheOptions {
  /** TTL in milliseconds (default: 60_000 = 1 minute) */
  ttl?: number;
  /** Tag for grouped invalidation */
  tag?: string;
}

interface CacheStats {
  size: number;
  keys: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
}

export class MemoryCache {
  private store: Map<string, CacheEntry<any>>;
  private defaultTTL: number;
  private totalHits: number = 0;
  private totalMisses: number = 0;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(defaultTTL: number = 60_000) {
    this.store = new Map();
    this.defaultTTL = defaultTTL;
    // Auto cleanup every 5 minutes
    this.cleanupTimer = setInterval(() => this.cleanup(), 300_000);
  }

  /**
   * Get a cached value
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.totalMisses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.totalMisses++;
      return null;
    }
    entry.hits++;
    this.totalHits++;
    // If it's a null placeholder, return null
    if (entry.data === NULL_PLACEHOLDER) return null;
    return entry.data as T;
  }

  /**
   * Set a cached value
   */
  set<T>(key: string, data: T | null, options?: CacheOptions): void {
    const ttl = options?.ttl ?? this.defaultTTL;
    this.store.set(key, {
      data: data === null ? NULL_PLACEHOLDER : data,
      expiresAt: Date.now() + ttl,
      hits: 0,
    });
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Delete all keys with a given tag prefix
   */
  deleteByTag(tag: string): number {
    let deleted = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(tag)) {
        this.store.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.store.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
  }

  /**
   * Get or compute — the classic pattern
   */
  async getOrCompute<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    // Cache miss — fetch and store
    const data = await fetcher();
    this.set(key, data, options);
    return data;
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let deleted = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.totalHits + this.totalMisses;
    return {
      size: this.store.size,
      keys: this.store.size,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRate: total > 0 ? this.totalHits / total : 0,
    };
  }

  /**
   * Get all keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Stop the cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// Singleton instance for the app
export const appCache = new MemoryCache();
export const SEARCH_CACHE_TTL = 60_000; // 1 minute
export const LIST_CACHE_TTL = 30_000; // 30 seconds

export { NULL_PLACEHOLDER };
export type { CacheOptions, CacheStats };
