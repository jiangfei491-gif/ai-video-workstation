# P1 完成报告 — Repository 实现

> **阶段**：P1 Repository 实现  
> **默认模式**：`legacy`（JSON SoT）  
> **状态**：✅ 完成 · **未接业务 · 未迁移数据 · 无双写**

## 架构

```text
业务代码（P2 接入）
       ↓
createRepositoryBundle() / getRepositoryBundle()
       ↓
   ┌───────────┴───────────┐
   │                       │
Legacy Repository    PostgreSQL Repository
（默认）              （REPOSITORY_MODE=postgres）
   ↓                       ↓
JSON 文件              PostgreSQL（M0）
~/Desktop/AI-Veo/...
```

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `REPOSITORY_MODE` | `legacy` | `legacy` \| `postgres` |
| `DATABASE_URL` | `localhost:5433` | postgres 模式 |

## 使用（基础设施层测试）

```typescript
import { createRepositoryBundle, checkRepositoryConnectivity } from "@/database/repositories";

const repos = createRepositoryBundle(); // Legacy 默认
const materials = await repos.material.listByWorkspace("...");
```

**P1 禁止** `app/` 引用上述模块。

## 门控（P1 后仍禁止）

- ❌ 修改 app/ 业务/API/UI
- ❌ 双写 / 读切换
- ❌ JSON / Workbench 数据迁移
