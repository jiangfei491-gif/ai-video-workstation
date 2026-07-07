# AI Cut V1 — 数据库基础设施

> **当前阶段：P2 基础设施已完成（M0/P1/P2）。**  
> **默认**：Legacy 读 · 无双写 · 不迁移 · 不改业务代码。

## 四条底层原则

| 主线 | 说明 |
|------|------|
| **Project** | 唯一业务主线 — 一切业务数据挂 `project_id` |
| **Asset** | 唯一媒体主线 — 二进制进对象存储，PG 只登记 `assets` |
| **Job** | 唯一任务主线 — 长任务统一进 `jobs` |
| **Registry** | 唯一扩展主线 — 新 Center/Model 只 INSERT Registry |

## 文档入口

| 文档 | 用途 |
|------|------|
| **[DATABASE_DESIGN.md](./DATABASE_DESIGN.md)** | ★ 15 项交付总览（目录/Schema/ER/Repository/迁移/风险） |
| **[DATABASE_REVIEW.md](./DATABASE_REVIEW.md)** | 97 表只读审查报告 |
| **[migrations/AUDIT_GATE.md](./migrations/AUDIT_GATE.md)** | ★ 人工审核清单（通过前禁止一切迁移） |
| [docs/migration-plan.md](./docs/migration-plan.md) | 分阶段迁移计划 |
| [docs/risk-analysis.md](./docs/risk-analysis.md) | 风险矩阵 |
| **[WORKSPACE_REPORT.md](./WORKSPACE_REPORT.md)** | ★ 统一工作目录 Workspace Root |

## AI Video OS 数据分层

```text
Identity → Registry → Project → Library → Asset → Timeline → Execution → QA → Export → Cost → Logs
```

## 目录结构

见 [DATABASE_DESIGN.md §①](./DATABASE_DESIGN.md#-数据库目录结构)。

## 使用方式（M0 已落地）

```bash
cd database && docker compose up -d          # PostgreSQL（端口 5433）
bash database/scripts/m0-init.sh           # Schema + Registry Seed
```

连接：`postgresql://ai_cut:ai_cut_dev@localhost:5433/ai_cut_v1`（见 `.env.example`）

完成报告：`M0_REPORT.md`

## 使用方式（P1 Repository 已实现）

```typescript
// 基础设施层（app/ 尚未接入）
import { createRepositoryBundle } from "./repositories";
const repos = createRepositoryBundle(); // 默认 Legacy
```

报告：`P1_REPORT.md` · 默认 `REPOSITORY_MODE=legacy`

## 使用方式（P2 基础设施已完成）

```bash
npm run test:database          # 15 项测试
```

```typescript
import { createRepositoryBundle } from "./repositories";
import { runMigrationBatch, runConsistencyCheck } from "./migrations/framework";
import { getDefaultStorageProvider } from "./storage/factory";
import { getDefaultRedisServices } from "./redis/factory";
```

报告：`P2_REPORT.md` · 默认 Legacy + 无双写 + 不迁移

## 使用方式（P3 — 未开始）

业务层接入 `createRepositoryBundle()`；需人工批准后开启双写/迁移。

## 其他原则

| 原则 | 说明 |
|------|------|
| Center | Agent → Center → Engine → Timeline → OpenCut；Center 互不直接调用 |
| Workbench | 目标态仅存 projectId、UI 状态、syncVersion |
| JSON | 保留作兼容/备份层，永不删除 |
