/**
 * Redis Queue 接口（P2 — 默认 Noop）
 */

export interface IRedisQueue {
  readonly enabled: boolean;
  push(queue: string, payload: string): Promise<void>;
  pop(queue: string): Promise<string | null>;
  length(queue: string): Promise<number>;
}

export interface IRedisQueueFactory {
  create(): IRedisQueue;
}

export function createNoopQueue(enabled = false): IRedisQueue {
  const fail = () => {
    if (enabled) throw new Error("[P2] Redis Queue 未连接");
  };
  return {
    enabled,
    async push(_q, _p) {
      fail();
    },
    async pop(_q) {
      fail();
      return null;
    },
    async length(_q) {
      fail();
      return 0;
    },
  };
}

/** 内存 Queue — 供测试 */
export function createMemoryQueue(): IRedisQueue {
  const store = new Map<string, string[]>();
  return {
    enabled: true,
    async push(queue, payload) {
      const arr = store.get(queue) ?? [];
      arr.push(payload);
      store.set(queue, arr);
    },
    async pop(queue) {
      const arr = store.get(queue) ?? [];
      return arr.shift() ?? null;
    },
    async length(queue) {
      return (store.get(queue) ?? []).length;
    },
  };
}
