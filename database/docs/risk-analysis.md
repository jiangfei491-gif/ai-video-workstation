# 数据迁移风险分析

> 关联：`DATABASE_DESIGN.md` §13 · 审核前必读

## 风险矩阵

| ID | 风险 | 等级 | 影响 | 缓解措施 |
|----|------|------|------|----------|
| R1 | workbench:t2v 无 project_id，迁移丢项目 | **高** | 用户项目丢失 | D4 前全量 backup localStorage；引入 project_shots UUID |
| R2 | shotIndex 当主键，删镜错位 | **高** | 媒体/Plan 对错镜 | 迁移时建 project_shots；保留 shot_index 作排序 |
| R3 | 首帧/视频无 JSON 索引 | **高** | assets 漏登记 | D3 扫 `~/Desktop/AI-Veo/` 补 assets |
| R4 | 提前双写导致双 SoT 不一致 | **高** | 剪辑/Plan 损坏 | **审核前禁止双写**；双写需另批 + 对账 job |
| R5 | 提前切换读 PG | **高** | API 返回空/旧数据 | 切换前 Repository 集成测试 + 影子读对比 |
| R6 | artifact 与 timeline 投影不同步 | 中 | 渲染错误 | 单一写入路径：artifact → 投影 job |
| R7 | 四套 Library 表与 templates 数据分裂 | 中 | 模板找不到 | 迁移期定 SoT；或先合并再迁 |
| R8 | legacy id 映射遗漏 | 中 | 无法对照 JSON | 每批次写 legacy_json_mappings |
| R9 | 对象存储 key 变更导致链接失效 | 中 | 媒体 404 | 保留 legacy_filepath；渐进改 storage_key |
| R10 | Registry seed 与代码 TS 不一致 | 低 | 模块对不上 | seed 与 module-registry 对账脚本 |
| R11 | 97 表运维复杂度 | 低 | 慢查询/备份大 | 索引见 999_indexes；分库评估放 V2 |
| R12 | Redis 未部署即接 Job 队列 | 低 | 渲染阻塞 | Phase D6 前可 PG 轮询；Redis 可选 |

## 不可接受的操作（审核前）

1. ❌ 执行 `migrations/data/*`
2. ❌ Feature flag 打开 `AI_CUT_DB_WRITE`
3. ❌ 修改 API 默认从 PG 读 workbench
4. ❌ 删除或 truncate JSON 文件
5. ❌ Center 直连 PostgreSQL（绕过 Repository）

## 回滚策略

| 阶段 | 回滚 |
|------|------|
| M0 建空库 | `DROP DATABASE` 或保留空库不影响现网 |
| D1–D3 库内无项目数据 | truncate 相关表 |
| D4+ 已有 project | 停 PG 写；恢复 JSON SoT；pg_restore |

## 四条主线约束（降风险）

| 主线 | 约束 |
|------|------|
| **Project** | 一切业务数据必须 `project_id`；禁止 orphan 媒体 |
| **Asset** | 二进制只进对象存储；PG 只登记 assets |
| **Job** | 长任务只进 jobs；禁止散落 job 表 |
| **Registry** | 新 Center/Model 只 INSERT；禁止改 projects 结构 |

## 审核建议

- **先 M0 + Repository 实现 + 集成测试**，再讨论 D1
- **D4（workbench 拆分）为最高风险点**，需专项方案与对账
- 重叠表（见 DATABASE_REVIEW §8）可在迁移前合并 Schema，或迁移后迭代 — 需架构拍板
