# Redis 设计

> 本阶段 **不部署 Redis**。以下为第二阶段架构约定。

## 适合 Redis

| 用途 | Key 模式 | TTL | 说明 |
|------|----------|-----|------|
| Job 队列 | `queue:jobs:{type}` | — | BullMQ，Veo/渲染/进化 |
| Job 进度 | `job:progress:{id}` | 24h | SSE 轮询 / PubSub |
| SSE 通道 | `channel:job:{id}` | 1h | 多实例广播 |
| TTS 缓存 | `cache:tts:{sha256}` | 7d | 相同文本+音色 |
| 字幕缓存 | `cache:subtitle:{sha256}` | 7d | |
| Rate limit | `rl:api:{ip}` | 1m | OpenAI/Veo 限流 |
| 分布式锁 | `lock:shot:{project}:{shot}` | 30s | Shot Lock 并发 |
| OpenCut 启动锁 | `lock:opencut:bootstrap` | 60s | |
| Activity 热缓冲 | `stream:activity:{workspace}` | — | 最近 N 条，异步落 PG |
| Workbench sync | `wb:sync:{project}:{user}` | 5m | 乐观锁 / 冲突检测 |

## 不适合 Redis（必须 PostgreSQL）

| 数据 | 原因 |
|------|------|
| Project / Settings | 权威 SoT |
| Artifact 版本 | 需回退、审计 |
| materials / characters | 事实数据 |
| cost_ledger | 财务审计 |
| qa_reports | 长期留存 |
| assets 元数据 | 与 PG 一致 |

## 可选：Redis 作 PG 缓存

- `cache:registry:*` — Registry 只读缓存，invalidate on INSERT
- **不缓存** 完整 EditGraph payload（过大，走 PG JSONB）

## 与 Repository 关系

```text
Repository → Redis（可选 CacheAside）→ PostgreSQL
Job Worker → Redis Queue → 写 JobRepository + AssetRepository
```

业务代码 **不直接** 访问 Redis；通过 `JobService` / `CacheService` 门面（第二阶段）。
