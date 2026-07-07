# Migration 目录说明

> **当前状态：审核门控 — 禁止执行任何数据迁移、禁止双写、禁止切换读写到 PostgreSQL。**

## 目录规划（审核通过后启用）

```text
database/migrations/
├── README.md                 # 本文件 — 策略与门控
├── AUDIT_GATE.md             # 人工审核清单（必须通过）
├── schema/                   # 结构迁移（DDL）— 与 ../schema 对齐
│   └── README.md
└── data/                     # 数据迁移（DML）— 审核通过后再编写
    └── README.md
```

## Schema 迁移（DDL）

**现状**：初始 DDL 已在 `database/schema/000_init.sql` 定义，**不等同于已部署生产库**。

审核通过后的 **Phase M0**（仅建空库）：

```bash
# 仅在审核签字后、由运维手动执行
psql "$DATABASE_URL" -f database/schema/000_init.sql
psql "$DATABASE_URL" -f database/seeders/001_registry.sql
```

后续 Schema 变更命名规则：

```text
database/migrations/schema/
  M001__add_xxx.sql
  M002__alter_yyy.sql
```

原则：**只增 Registry / 只加 nullable 列**；禁止破坏性 ALTER 核心业务表。

## 数据迁移（DML）

**本目录 `data/` 在审核通过前保持空。**

审核通过后的数据迁移批次（见 `docs/migration-plan.md`）：

| 批次 | 内容 | 前置条件 |
|------|------|----------|
| D1 | Workspace + 默认用户 | M0 完成 |
| D2 | materials / characters / scenes / props | D1 |
| D3 | assets 索引（扫磁盘） | D2 |
| D4 | projects ← workbench 拆分 | D3 + Repository 实现 |
| D5 | artifact_versions / timelines | D4 |
| D6 | jobs / history / cost | D5 |

**禁止**：在未完成 D4 前对线上 `workbench:t2v` 做任何写切换。

## 与 JSON 的关系

- 迁移期间 JSON **继续为 SoT**
- `legacy_json_mappings` 仅在 D2+ 批次写入
- JSON 文件 **永不删除**（备份层）

## 回滚

- DDL：保留 down migration 脚本（审核后编写）
- DML：每批次前 snapshot JSON + `pg_dump`；失败则停写 PG、继续 JSON SoT
