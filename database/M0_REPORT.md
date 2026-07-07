# M0 完成报告

> **阶段**：M0 数据库落地（基础设施）  
> **日期**：2026-06-30  
> **状态**：✅ 已完成 · **未接业务 · 未迁移数据**

## 验证结果

| # | 检查项 | 结果 |
|---|--------|------|
| 1 | PostgreSQL 已建立 | ✅ Docker `ai-cut-postgres`，端口 **5433**（5432 被 OpenCut 占用） |
| 2 | Schema 全部建立 | ✅ `000_init.sql` 执行成功 |
| 3 | 数据表数量 | **98**（97 业务表 + 1 `schema_migrations`） |
| 4 | View 数量 | **6** |
| 5 | 外键数量 | **161** |
| 6 | 索引数量 | **73**（不含主键） |
| 7 | Registry 初始化 | ✅ 见下表 |
| 8 | Repository 框架 | ✅ 契约 + 占位，**无 SQL 实现** |
| 9 | Storage 接口 | ✅ Local 骨架 + 云预留 |
| 10 | Redis 接口 | ✅ Noop，**未启用** |
| 11 | 修改业务代码 | **否**（`app/` 无 `database/` 引用） |
| 12 | 数据迁移 | **否**（仅 Registry seed，无 JSON/workbench 迁移） |

## 连接信息

```text
DATABASE_URL=postgresql://ai_cut:ai_cut_dev@localhost:5433/ai_cut_v1
```

```bash
cd database && docker compose up -d    # 启动
bash database/scripts/m0-init.sh       # 重建 Schema + Seed
```

## Registry 初始化统计

| Registry | 行数 |
|----------|------|
| agent_registry | 14 |
| center_registry | 12 |
| provider_registry | 16 |
| model_registry | 15 |
| workflow_registry | 5 |
| job_registry | 18 |
| artifact_registry | 7 |
| resource_registry | 8 |
| template_registry | 8 |
| permission_registry | 9 |
| integration_registry | 5 |
| engine_registry | 8 |

## Migration 追踪

| version | name | 说明 |
|---------|------|------|
| M000 | baseline | `000_init.sql` |

后续 DDL → `docs/migration-convention.md`

## 门控（M0 后仍禁止）

- ❌ Repository 实现（P1）
- ❌ 双写 / 读切换
- ❌ workbench / JSON 数据迁移
- ❌ 修改 app/ 业务/API/UI
