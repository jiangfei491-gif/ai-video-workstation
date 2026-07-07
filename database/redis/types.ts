/**
 * AI Cut V1 — Redis 类型（M0 仅接口，不启用）
 */

export type RedisKeyNamespace =
  | "queue:jobs"
  | "job:progress"
  | "channel:job"
  | "cache:tts"
  | "cache:subtitle"
  | "rl:api"
  | "lock:shot"
  | "lock:opencut"
  | "stream:activity"
  | "wb:sync"
  | "cache:registry";

export interface RedisSetOptions {
  ttlSec?: number;
  nx?: boolean;
}

export interface RedisPublishOptions {
  channel: string;
}

export interface RedisQueuePushOptions {
  queue: string;
}

export interface RedisConfig {
  enabled: boolean;
  url?: string;
  keyPrefix?: string;
}
