# Resource Center Phase 3 — AI Analyzer / Library Manager / AI Resource Service

## 闭环流程

```
Source Manager → Crawler → Downloader → AI Analyzer (DeepSeek) → Library Manager → 12 Libraries
                                                                                        ↓
                                                                              AI Resource Service
                                                                                        ↓
                                    AI导演 / 素材中心 / 音乐中心 / 字幕中心 / 配音中心 / 特效中心 / OpenCut / QA中心
```

## 新增 Schema（046）

| 表 | 用途 |
|----|------|
| `resource_analysis_tasks` | AI 分析队列与结果 |
| `resource_analysis_logs` | AI 分析日志 |
| `resource_import_tasks` | 入库任务 |
| `resource_import_logs` | 入库日志 |
| `resource_library_items` | 统一 Library Item + Search Index |
| `resource_library_relations` | 重复/相似关系 |
| `resource_access_logs` | 资源调用日志 |

## 统一状态

| 阶段 | 状态值 |
|------|--------|
| 分析 | `pending_analysis` → `analyzing` → `analysis_complete` / `analysis_failed` |
| 入库 | `pending_import` → `importing` → `imported` / `import_failed` |
| 资源 | `imported` / `disabled` / `deleted` |

## 代码入口

| 模块 | 路径 |
|------|------|
| AI Analyzer | `app/lib/resource-center/phase3/ai-analyzer/` |
| DeepSeek Agent | `app/lib/resource-center/phase3/ai-analyzer/deepseek-agent.ts` |
| Library Manager | `app/lib/resource-center/phase3/library-manager/manager.ts` |
| AI Resource Service | `app/lib/resource-center/phase3/ai-resource-service.ts` |
| HTTP 唯一调用口 | `GET/POST /api/ai-resource` |

## 环境变量

- `DEEPSEEK_API_KEY` — 启用 DeepSeek 分析（未配置时使用规则回退）
- `DEEPSEEK_MODEL` — 默认 `deepseek-chat`

## 应用 Schema

```bash
bash database/scripts/apply-phase3-schema.sh
```

## 测试

```bash
npx tsx --test database/tests/resource-center-phase3.test.ts
```

## 各 Center 接入方式（未改业务逻辑）

```typescript
// 唯一合法资源调用
const res = await fetch("/api/ai-resource?action=search&libraryId=music&q=ambient");
// 或
import { getAIResourceService } from "@/app/lib/resource-center/phase3";
const svc = getAIResourceService();
await svc.search({ libraryId: "music", q: "ambient" }, { moduleId: "music-center" });
```

请求头（可选）：`x-ai-module-id`, `x-ai-module-label` — 写入 `resource_access_logs`。
