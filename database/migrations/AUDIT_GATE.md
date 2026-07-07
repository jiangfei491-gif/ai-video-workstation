# 数据库人工审核门控

> **以下全部勾选前：禁止迁移、禁止双写、禁止切换数据库读写。**

## A. 架构原则

- [ ] 已确认四条主线：**Project / Asset / Job / Registry**
- [ ] 已确认 Center 不互调：Agent → Center → Engine → Timeline → OpenCut
- [ ] 已确认 Workbench 未来仅 UI + projectId + syncVersion
- [ ] 已确认 JSON 保留为兼容/备份层，不删除

## B. Schema 审核

- [ ] 已阅读 `DATABASE_DESIGN.md` 全文
- [ ] 已阅读 `DATABASE_REVIEW.md` 重叠与合并建议
- [ ] 97 表 + 6 视图规模可接受
- [ ] 接受 artifact 摘要表与 JSONB 双存（或记录后续合并任务）
- [ ] 接受 Library 四套 `*_library` 与 `templates` 并存（或记录合并任务）

## C. 迁移策略

- [ ] 同意分阶段迁移计划（`docs/migration-plan.md`）
- [ ] 同意 **无双写期** 或明确双写窗口（若选双写需另批）
- [ ] 同意对象存储布局（`docs/object-storage.md`）
- [ ] 同意 Redis 角色（`docs/redis.md`）— 热数据 only

## D. Repository

- [ ] 同意业务代码 **禁止直连 PostgreSQL**
- [ ] 同意 `repositories/interfaces.ts` 契约为唯一数据访问边界

## E. 风险签收

- [ ] 已阅读 `docs/risk-analysis.md`
- [ ] 指定迁移负责人与回滚负责人

---

**签字栏（审核通过后填写）**

| 角色 | 姓名 | 日期 |
|------|------|------|
| 产品/架构 | | |
| 后端 | | |
| 运维 | | |

**批准进入 Phase M0（仅建空库）**： ☐  
**批准进入 Phase D*（数据迁移）**： ☐
