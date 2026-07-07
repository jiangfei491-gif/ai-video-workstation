# 数据迁移计划

> **当前状态：审核门控。** 禁止迁移、禁止双写、禁止切换数据库。  
> 门控清单：`../migrations/AUDIT_GATE.md`  
> 总览：`../DATABASE_DESIGN.md` §12

---

## 原则

1. **四条主线**：Project / Asset / Job / Registry — 新功能不增核心表
2. **不删除 JSON** — 迁移后 JSON 为只读备份 / 兼容 fallback
3. **不改 API 契约** — `{ workbench }` 保持不变，Repository 内部适配
4. **不改业务逻辑** — 仅换数据源（审核后阶段）
5. **可回滚** — 每批次前 snapshot + pg_dump
6. **审核前禁止双写** — P2 双写需 `AUDIT_GATE` 另批

---

## 阶段

| 阶段 | 内容 | 读写策略 | 状态 |
|------|------|----------|------|
| **P0** | Schema + Registry seed + Repository 接口 | 无 PG | ✅ 完成 |
| **审核** | `AUDIT_GATE.md` 人工签字 | — | ⏸ **当前** |
| **M0** | 建空库 + seed | JSON SoT | 待审核 |
| **P1** | PostgreSQL Pool + Repository 实现 | JSON only | 待 M0 |
| **D1** | Workspace + 默认用户 | JSON SoT | 待 P1 |
| **D2** | materials/characters/scenes/props | JSON SoT | 待 D1 |
| **D3** | assets 扫盘 + storage_key | JSON SoT | 待 D2 |
| **D4** ⚠ | projects ← workbench:t2v 拆分 | JSON SoT + 影子读 | 待 D3 |
| **D5** | artifact_versions + timelines | 对账 | 待 D4 |
| **D6** | jobs + history + cost | — | 待 D5 |
| **P7** | 读切换 DB 为主 | **需另批** | 待 D6 验证 |
| **P8** | 可选停 JSON 写 | **仍不删文件** | 可选 |

> **注意**：原 P2「新 Project 双写」已移出默认路径；仅在审核明确批准「双写窗口」后启用，并需对账 job。

---

## 数据迁移批次（D*）

| 批次 | 脚本（审核后编写） | 内容 |
|------|-------------------|------|
| D1 | `D001__workspace.sql` | 默认 workspace + user |
| D2 | `D002__library.sql` | materials, characters, scenes, props |
| D3 | `D003__assets_scan.sql` | 扫 `~/Desktop/AI-Veo/` → assets |
| D4 | `D004__workbench_split.sql` | workbench:t2v → projects + … |
| D5 | `D005__artifacts_timelines.sql` | Plan/Graph + 投影 |
| D6 | `D006__jobs_cost_history.sql` | jobs, snapshots, cost |

每批次要求：

- dry-run 模式
- 写入 `legacy_json_mappings`
- **不删除** 源 JSON
- 失败即停，继续 JSON SoT

---

## 迁移顺序（数据）

1. Registry seed（SQL 已备）
2. Workspace + 默认用户
3. assets + 对象存储 key 规范化（扫磁盘补索引）
4. materials / resources
5. projects ← workbench:t2v 拆分
6. artifact_versions ← directorPlan / editGraph
7. timelines 投影
8. jobs ← auto-edit-jobs + veo taskId
9. history snapshots
10. cost_ledger / usage_stats

---

## 不回迁 / 可丢弃

- sessionStorage data URL 缓存
- 进程内存 logs（迁移前即丢失）
- model/style performance 聚合 JSON（可重算）
- tmpdir 临时文件

---

## 验证清单（D6 完成后）

- [ ] 同一 project_id 在 DB 与 workbench 字段一致
- [ ] asset storage_key 可下载
- [ ] artifact 版本回退可用
- [ ] legacy_json_mappings 100% 覆盖已导入 JSON id
- [ ] API 响应形状不变
- [ ] 四条主线无 orphan 数据

---

## 读切换 / 双写（另批）

仅在以下条件 **全部满足** 后讨论：

1. `AUDIT_GATE.md` 「批准进入 Phase D*」已签
2. D1–D6 验证清单通过
3. Repository 集成测试通过
4. 架构/产品书面批准 P7 或双写窗口

Feature flag（审核后实现，**当前禁止启用**）：

- `AI_CUT_DB_READ` — 读 PG fallback JSON
- `AI_CUT_DB_WRITE` — 写 PG（双写期）
