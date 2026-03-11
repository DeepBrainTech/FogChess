/**
 * CacheService – future caching layer (not wired).
 * Planned for: user profiles, room metadata, session data, etc.
 */

export interface CacheOptions {
  ttlSeconds?: number;
  namespace?: string;
}

const DEFAULT_TTL = 300; // 5 minutes

export class CacheService {
  private _enabled = false;
  private _ttl = DEFAULT_TTL;

  constructor(opts?: { ttl?: number }) {
    this._ttl = opts?.ttl ?? DEFAULT_TTL;
  }

  /** Enable cache (call when Redis/client ready) */
  enable(): void {
    this._enabled = true;
  }

  /** Disable cache */
  disable(): void {
    this._enabled = false;
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  /** Get value by key. Returns null if miss or disabled. */
  async get<T>(key: string): Promise<T | null> {
    if (!this._enabled) return null;
    // TODO: wire to Redis/memory store
    return null;
  }

  /** Set value with optional TTL */
  async set(key: string, value: unknown, opts?: CacheOptions): Promise<void> {
    if (!this._enabled) return;
    const ttl = opts?.ttlSeconds ?? this._ttl;
    // TODO: wire to Redis/memory store
    void key;
    void value;
    void ttl;
  }

  /** Delete key */
  async del(key: string): Promise<void> {
    if (!this._enabled) return;
    // TODO: wire to store
    void key;
  }

  /** Build namespaced key */
  key(namespace: string, id: string): string {
    return `fogchess:${namespace}:${id}`;
  }

  /** Get or compute and cache value */
  async getOrSet<T>(key: string, loader: () => Promise<T>, opts?: CacheOptions): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached != null) return cached;
    const value = await loader();
    await this.set(key, value, opts);
    return value;
  }

  /** Clear all keys in namespace (no-op until store wired) */
  async clearNamespace(_namespace: string): Promise<void> {
    if (!this._enabled) return;
    // TODO: SCAN + DEL for fogchess:{namespace}:*
  }
}

export const cacheService = new CacheService();
