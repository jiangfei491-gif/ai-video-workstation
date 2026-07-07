# Redis 层（M0）

> **本阶段不部署、不连接 Redis。** 仅建立接口与 Noop 实现。

## 结构

```text
database/redis/
├── types.ts           # Key 命名空间、配置类型
└── redis-client.ts    # IRedisClient + createNoopRedisClient
```

## M0 行为

- `REDIS_ENABLED=false`（默认）→ 所有方法 no-op / 返回空
- `REDIS_ENABLED=true` → **抛错**，防止误启用

## 第二阶段启用项

| 功能 | Key 模式 |
|------|----------|
| Job Queue | `queue:jobs:{type}` |
| Job 进度 | `job:progress:{id}` |
| Cache | `cache:tts:{sha256}` |
| Rate Limit | `rl:api:{ip}` |
| Lock | `lock:shot:{project}:{shot}` |

详见 `docs/redis.md`。

## 规范

- 业务代码 **不得** 直接 `import ioredis`
- 须经 `IRedisClient` 门面（第二阶段 `app/lib/cache/` 或 `database/redis/` 工厂）
