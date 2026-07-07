/**
 * AI Cut V1 — Redis 客户端接口（M0 仅接口，不启用）
 *
 * 第二阶段启用：Job Queue / Cache / Rate Limit / Distributed Lock
 * 业务代码不得直接 import ioredis；须经 IRedisClient 门面。
 */

import type { RedisConfig, RedisQueuePushOptions, RedisSetOptions } from "./types";

export interface IRedisClient {
  readonly enabled: boolean;

  ping(): Promise<boolean>;

  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: RedisSetOptions): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;

  /** 分布式锁（SET NX EX） */
  acquireLock(key: string, ttlSec: number, token: string): Promise<boolean>;
  releaseLock(key: string, token: string): Promise<boolean>;

  /** 队列（第二阶段 BullMQ 适配） */
  pushQueue(options: RedisQueuePushOptions, payload: string): Promise<void>;

  /** Pub/Sub（SSE 广播） */
  publish(channel: string, message: string): Promise<void>;

  /** Stream 追加（Activity 热缓冲） */
  xadd(stream: string, fields: Record<string, string>): Promise<string>;
}

export interface IRedisClientFactory {
  create(config: RedisConfig): IRedisClient;
  getDefault(): IRedisClient;
}

/** M0：返回 Noop 客户端，不连接 Redis */
export function createRedisClientFactory(): IRedisClientFactory {
  return {
    create(config) {
      return createNoopRedisClient(config);
    },
    getDefault() {
      return createNoopRedisClient({ enabled: false });
    },
  };
}

export function createNoopRedisClient(config: RedisConfig): IRedisClient {
  const disabled = () => {
    if (config.enabled) {
      throw new Error(
        "[M0] REDIS_ENABLED=true 但 Redis 尚未接入。请等待第二阶段启用。"
      );
    }
  };

  return {
    enabled: config.enabled,

    async ping() {
      disabled();
      return false;
    },
    async get(_key) {
      disabled();
      return null;
    },
    async set(_key, _value, _options?) {
      disabled();
    },
    async del(_key) {
      disabled();
    },
    async exists(_key) {
      disabled();
      return false;
    },
    async acquireLock(_key, _ttlSec, _token) {
      disabled();
      return false;
    },
    async releaseLock(_key, _token) {
      disabled();
      return false;
    },
    async pushQueue(_options, _payload) {
      disabled();
    },
    async publish(_channel, _message) {
      disabled();
    },
    async xadd(_stream, _fields) {
      disabled();
      return "";
    },
  };
}
