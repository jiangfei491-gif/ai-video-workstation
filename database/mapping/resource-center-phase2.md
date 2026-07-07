# Resource Center Phase 2 — 交付报告

> Source Manager + Crawler Framework + Downloader  
> 日期：2026-06-29 · **本阶段已停止**

---

## 1. Source Manager 是否完成？

**是。**

- 服务：`app/lib/resource-center/phase2/source-manager.ts`
- API：`/api/resource-center/sources`（CRUD、搜索、统计、启用/禁用）
- 测试连接：`POST /api/resource-center/sources/[id]/test`
- UI：资源中心 → **资源站** Tab

支持字段：名称、网址、资源类型、分类、国家、语言、授权、License、API、RSS、登录/API Key、Crawler/Downloader 开关、Provider、抓取频率、状态、备注。

---

## 2. 默认资源站数量

**12 个**（来自数据库 Seed，非硬编码）

| 名称 | 绑定库 |
|------|--------|
| Pixabay Music | music |
| Freesound SFX | sfx |
| Unsplash Images | image |
| Pixabay Videos | video |
| OpenSubtitles Templates | subtitle |
| OpenVideo FX Hub | effect |
| Character Hub | character |
| Civitai LoRA | lora |
| Brand Assets Hub | brand |
| HuggingFace Datasets | dataset |
| Voice Presets Hub | voice |
| Prompt Templates Hub | prompt |

Seed：`database/seeders/002_resource_sources.sql`  
初始化：`bash database/scripts/apply-phase2-schema.sh`

---

## 3. Crawler Framework 是否完成？

**是。**

- 接口：`CrawlerProvider`（`phase2/crawler/provider.ts`）
- 内置 Provider：`generic-http`、`generic-rss`（**不针对单一网站**）
- 注册表：`phase2/crawler/registry.ts` — `registerCrawlerProvider()` 扩展

---

## 4. Provider 架构

```text
CrawlerManager
    ↓ requireCrawlerProvider(source.provider_slug)
CrawlerProvider (统一接口)
    ├── testConnection(source)
    ├── listResources(source, { page, pageSize, query })
    ├── getDetail(source, externalId)
    ├── getDownloadUrl(source, externalId)
    └── search?(source, query, params)

新增资源站步骤见 §9
```

---

## 5. Downloader 是否完成？

**是。**

- 服务：`phase2/downloader/manager.ts`
- 能力：下载、暂停、恢复、取消、失败重试、断点续传（`.part` + Range）、SHA256 校验、速度统计、队列、日志
- API：`/api/resource-center/downloads/tasks`
- 输出目录：`storage/downloads/{sourceId}/{taskId}/`

**不写入 Library** — 等待下一阶段 AI Analyzer。

---

## 6. 支持哪些资源站类型？

12 种内容库类型均可绑定（`resource_types[]`）：

`image` · `video` · `music` · `sfx` · `voice` · `subtitle` · `effect` · `prompt` · `character` · `lora` · `brand` · `dataset`

Provider 类型（可扩展）：

- `generic-http` — 通用 HTTP/API
- `generic-rss` — 通用 RSS

---

## 7. 数据库新增哪些表？

| 表 | 用途 |
|----|------|
| `resource_sources` | 资源站（Source Manager） |
| `resource_crawler_tasks` | 抓取任务队列 |
| `resource_crawler_logs` | 抓取日志 |
| `resource_download_tasks` | 下载任务队列 |
| `resource_download_logs` | 下载日志 |

Schema：`database/schema/045_resource_center_phase2.sql`  
Repository：`database/repositories/resource-center/`

---

## 8. 目录结构

```text
~/AI Video OS/
└── storage/
    ├── library/          # V1 内容库（未直接写入）
    │   ├── image/ … dataset/
    │   └── .resource-center-manifest.json
    └── downloads/        # Phase 2 下载暂存
        └── {sourceId}/
            └── {taskId}/
                └── {filename}
```

---

## 9. 以后新增一个资源站需要几步？

1. **数据库**：`INSERT INTO resource_sources (...)` 或通过 UI/API 创建（指定 `provider_slug`、`resource_types`）
2. **（可选）Provider**：若 `generic-http` / `generic-rss` 不够用，实现 `CrawlerProvider` 并 `registerCrawlerProvider()`
3. **启用**：`enabled = true`，`POST .../test` 测试连接
4. **抓取**：`POST /api/resource-center/crawler/tasks` `{ source_id }`
5. **下载**：Crawler 自动创建 Download Task → 文件进入 `storage/downloads/`
6. **下一阶段**：AI Analyzer 分析后入库 Library（本阶段未实现）

**无需修改 CrawlerManager / Downloader 核心代码。**

---

## 统一流程

```text
Source Manager → Crawler (Provider) → Downloader → storage/downloads/
                                              ↓
                                    （下一阶段 AI Analyzer → Library）
```

---

## 本阶段未做（按需求）

- AI Analyzer / 自动分类 / 自动标签 / 自动入库
- 写入 Library
- 修改 Center / Agent / AI 导演 / 业务流程

---

## 验证

```bash
bash database/scripts/apply-phase2-schema.sh
npx tsx --test database/tests/resource-center-phase2.test.ts
```

访问 `/resources` → 资源站 / 抓取 / 下载 Tab。

---

## 十、Crawler Scheduler（抓取调度器）

**已完成。**

### 能力

| 类别 | 支持项 |
|------|--------|
| 调度动作 | 自动抓取、手动抓取、立即同步、暂停、恢复、停止 |
| 资源站配置 | 启用、自动/手动、频率（时/日/周/月/自定义 Cron）、多时间点、最大抓取数、扫描模式（仅新增/全量/增量）、优先级 |
| 全局配置 | 下载并发(5)、分析并发(3)、失败重试、超时(300s)、速度限制、CPU 限制、网络限制、轮询策略、日志保留、自动清理 |
| Dashboard | 运行/等待任务、三速监控、成功/失败统计、预计完成时间 |

### 默认配置

- 自动抓取：开启 · 每天 02:00 · 仅抓新增 · 每站 100 · 下载并发 5 · 分析并发 3 · 重试 3 · 超时 300s · 日志 90 天 · 自动入库：关闭（Phase 3 独立控制）

### 代码与 API

| 项 | 路径 |
|----|------|
| 调度器 | `app/lib/resource-center/phase2/scheduler/` |
| Schema | `database/schema/047_resource_center_scheduler.sql` |
| 全局配置 | `GET/PATCH /api/resource-center/scheduler` |
| Dashboard | `GET /api/resource-center/scheduler/actions` |
| 资源站调度 | `GET/PATCH/POST /api/resource-center/scheduler/sources/[id]` |
| UI | 资源中心 → **调度** Tab |

### 验证

```bash
bash database/scripts/apply-scheduler-schema.sh
npx tsx --test database/tests/resource-center-scheduler.test.ts
```
