import { getDatabaseInfraConfig } from "../config";
import { createNoopRedisClient, type IRedisClient } from "./redis-client";
import { createMemoryCache, createNoopCache, type IRedisCache } from "./cache";
import { createMemoryLock, createNoopLock, type IRedisLock } from "./lock";
import { createMemoryQueue, createNoopQueue, type IRedisQueue } from "./queue";
import { createMemorySse, createNoopSse, type IRedisSse } from "./sse";

export interface RedisServices {
  client: IRedisClient;
  queue: IRedisQueue;
  cache: IRedisCache;
  lock: IRedisLock;
  sse: IRedisSse;
}

export type RedisServicesMode = "noop" | "memory";

export function createRedisServices(mode: RedisServicesMode = "noop"): RedisServices {
  const cfg = getDatabaseInfraConfig();
  const enabled = cfg.redisEnabled;

  if (mode === "memory") {
    return {
      client: createNoopRedisClient({ enabled: false }),
      queue: createMemoryQueue(),
      cache: createMemoryCache(),
      lock: createMemoryLock(),
      sse: createMemorySse(),
    };
  }

  return {
    client: createNoopRedisClient({ enabled }),
    queue: createNoopQueue(enabled),
    cache: createNoopCache(enabled),
    lock: createNoopLock(enabled),
    sse: createNoopSse(enabled),
  };
}

export function getDefaultRedisServices(): RedisServices {
  return createRedisServices("noop");
}
