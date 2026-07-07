/**
 * Redis SSE / PubSub 接口（P2 — 默认 Noop）
 */

export type SseHandler = (message: string) => void;

export interface IRedisSse {
  readonly enabled: boolean;
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, handler: SseHandler): Promise<() => void>;
}

export function createNoopSse(enabled = false): IRedisSse {
  const fail = () => {
    if (enabled) throw new Error("[P2] Redis SSE 未连接");
  };
  return {
    enabled,
    async publish(_c, _m) {
      fail();
    },
    async subscribe(_c, _h) {
      fail();
      return () => undefined;
    },
  };
}

export function createMemorySse(): IRedisSse {
  const channels = new Map<string, Set<SseHandler>>();
  return {
    enabled: true,
    async publish(channel, message) {
      for (const h of channels.get(channel) ?? []) {
        h(message);
      }
    },
    async subscribe(channel, handler) {
      let set = channels.get(channel);
      if (!set) {
        set = new Set();
        channels.set(channel, set);
      }
      set.add(handler);
      return () => set!.delete(handler);
    },
  };
}
