/**
 * Redis Cache 接口（P2 — 默认 Noop）
 */

export interface CacheSetOptions {
  ttlSec?: number;
}

export interface IRedisCache {
  readonly enabled: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: CacheSetOptions): Promise<void>;
  del(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

export function createNoopCache(enabled = false): IRedisCache {
  const fail = () => {
    if (enabled) throw new Error("[P2] Redis Cache 未连接");
  };
  return {
    enabled,
    async get(_k) {
      fail();
      return null;
    },
    async set(_k, _v, _o?) {
      fail();
    },
    async del(_k) {
      fail();
    },
    async has(_k) {
      fail();
      return false;
    },
  };
}

export function createMemoryCache(): IRedisCache {
  const store = new Map<string, { value: string; expires?: number }>();
  return {
    enabled: true,
    async get(key) {
      const e = store.get(key);
      if (!e) return null;
      if (e.expires && Date.now() > e.expires) {
        store.delete(key);
        return null;
      }
      return e.value;
    },
    async set(key, value, options) {
      store.set(key, {
        value,
        expires: options?.ttlSec ? Date.now() + options.ttlSec * 1000 : undefined,
      });
    },
    async del(key) {
      store.delete(key);
    },
    async has(key) {
      return (await this.get(key)) !== null;
    },
  };
}
