/**
 * Redis 分布式锁接口（P2 — 默认 Noop）
 */

export interface IRedisLock {
  readonly enabled: boolean;
  acquire(key: string, ttlSec: number, token: string): Promise<boolean>;
  release(key: string, token: string): Promise<boolean>;
  isLocked(key: string): Promise<boolean>;
}

export function createNoopLock(enabled = false): IRedisLock {
  const fail = () => {
    if (enabled) throw new Error("[P2] Redis Lock 未连接");
  };
  return {
    enabled,
    async acquire(_k, _t, _tok) {
      fail();
      return false;
    },
    async release(_k, _tok) {
      fail();
      return false;
    },
    async isLocked(_k) {
      fail();
      return false;
    },
  };
}

export function createMemoryLock(): IRedisLock {
  const locks = new Map<string, { token: string; expires: number }>();
  return {
    enabled: true,
    async acquire(key, ttlSec, token) {
      const now = Date.now();
      const existing = locks.get(key);
      if (existing && existing.expires > now && existing.token !== token) {
        return false;
      }
      locks.set(key, { token, expires: now + ttlSec * 1000 });
      return true;
    },
    async release(key, token) {
      const existing = locks.get(key);
      if (existing?.token === token) {
        locks.delete(key);
        return true;
      }
      return false;
    },
    async isLocked(key) {
      const existing = locks.get(key);
      return Boolean(existing && existing.expires > Date.now());
    },
  };
}
