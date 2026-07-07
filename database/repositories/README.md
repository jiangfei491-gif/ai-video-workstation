# Repository 模式规范（P1）

## 强制规则

```text
app/api/*          ──┐
app/lib/*-center/* ──┼──► createRepositoryBundle() ──► Legacy | PostgreSQL
app/components/*   ──┘              ▲
                                    │
                         database/repositories/
```

1. **禁止** 在 `app/` 下 `import pg`、raw SQL。
2. **禁止** Center 互读写对方私有表。
3. **P1**：`app/` **尚未接入** Repository；仅 `database/repositories/` 可用。
4. **默认** `REPOSITORY_MODE=legacy`（JSON SoT）。

## 目录结构

```text
database/repositories/
├── interfaces.ts              # 全部 Repository 契约
├── factory.ts                 # Factory（默认 Legacy）
├── index.ts                   # 导出入口
├── shared/
│   ├── paths.ts               # ~/Desktop/AI-Veo 路径
│   ├── json-store.ts          # Legacy JSON 读写
│   └── client-only-stub.ts    # Workbench 客户端数据占位
├── legacy/
│   ├── create-bundle.ts       # Legacy Bundle 组装
│   ├── registry-data.ts       # Registry 静态数据
│   ├── json-adapter.ts
│   ├── library-repositories.ts
│   ├── asset-job-repositories.ts
│   ├── registry-repositories.ts
│   ├── identity-repositories.ts
│   ├── project-repositories.ts
│   └── domain-repositories.ts
└── pg/
    ├── pool.ts                # pg Pool
    ├── create-bundle.ts       # PostgreSQL Bundle 组装
    ├── library-repositories.ts
    ├── asset-job-repositories.ts
    ├── registry-repositories.ts
    ├── identity-repositories.ts
    ├── project-repositories.ts
    └── domain-repositories.ts
```

## Factory

```typescript
import { createRepositoryBundle } from "@/database/repositories";

// 默认 Legacy
const repos = createRepositoryBundle();

// PostgreSQL（不切换业务，仅基础设施测试）
const reposPg = createRepositoryBundle({ mode: "postgres" });
```

## Center 调用链（数据层）

```text
Agent Repository → Job Repository → Center Repository → Timeline / Artifact
```

Center **禁止** 直接调用另一个 Center 的 Repository。

## P1 报告

见 `database/P1_REPORT.md`
