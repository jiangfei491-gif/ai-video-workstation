# SHADOW_ARCHITECTURE_MAP

> 分类依据：真实 `import` + API 路由 + orchestrator 调用链 + 是否进入最终 MP4 产出。  
> **DEAD CANDIDATE ≠ 建议删除**（本审计禁止删除）。

---

## ACTIVE PRIMARY（主生产链）

| 模块 | 文件路径 | 分类 | 真实调用方 | 真实消费者 | 进入最终生产链 | 证据 |
|------|---------|------|-----------|-----------|---------------|------|
| runDirectorPipeline | `app/lib/director/run-director-pipeline.ts` | ACTIVE PRIMARY | `/api/director`；`runAiDirectorOrchestrator` | `buildDirectorWorkbenchPatch` / `applyDirectorPipelineToWorkbench` | 是（分镜源头） | 所有编导入口汇聚 |
| generateNarrativeStoryboard | `app/lib/narrative/generate-narrative-storyboard.ts` | ACTIVE PRIMARY | `runDirectorPipeline`（t2i） | `storyboard` + `narrativeBeats` | 是 | `outputMode === "image"` |
| splitNarrativeShots | `app/lib/narrative/generate-shots.ts` | ACTIVE PRIMARY | `generateNarrativeStoryboard` | `director.storyboard` | 是 | `directShotsFromUnits` |
| planNarrativeDuration | `app/lib/director/duration/plan-narrative-duration.ts` | ACTIVE PRIMARY | `runDirectorPipeline` | `storyboard[].duration` | 是（设计意图） | L94–114 run-director-pipeline |
| runAiDirectorOrchestrator | `app/lib/ai-director/run-orchestrator.ts` | ACTIVE PRIMARY | `/api/ai-director/run`；`run-manager.ts` | 多阶段 workbenchPatch | 是 | 一键编排入口 |
| runAutoEditPipeline | `app/lib/auto-edit/run-auto-edit-pipeline.ts` | ACTIVE PRIMARY | orchestrator `needEdit`；`/api/auto-edit/auto-pipeline`；`AiAutoEditShell` | `editGraph` | 是（剪辑编排） | 虽标 @deprecated 仍被调用 |
| EditGraph v2 | `app/lib/auto-edit/edit-graph/types.ts` | ACTIVE PRIMARY | `runAutoEditPipeline`；`refreshEditGraphFromWorkbench` | `graphToSequence` → render | 是 | types.ts L122 注释 SSOT |
| runRenderEngine | `app/lib/auto-edit/render-engine/run-render-engine.ts` | ACTIVE PRIMARY | `/api/auto-edit/render` | `finalEditVideoUrl` | **是（唯一 MP4）** | FFmpeg spawn |
| workbench session PG | `app/api/workbench/session/route.ts` | ACTIVE PRIMARY | `t2v-store` hydrate | 全 UI | 是（状态恢复） | `workbench_sessions.ui_state` |

---

## ACTIVE SECONDARY（生产链支路，仍活跃）

| 模块 | 文件路径 | 分类 | 真实调用方 | 真实消费者 | 进入最终生产链 | 证据 |
|------|---------|------|-----------|-----------|---------------|------|
| runAiCutPipeline | `app/lib/ai-cut/run-pipeline.ts` | ACTIVE SECONDARY | orchestrator `needPlan`；`/api/ai-cut/pipeline` | `directorPlan` + `openCutCommands` | 否（不渲染 MP4） | 编排层 |
| runBatchShotImages | `app/lib/ai-director/run-batch-images.ts` | ACTIVE SECONDARY | orchestrator media 阶段 | `shotFrames` / `imageTaskFrames` | 是（素材） | 上游媒体 |
| Veo generate | `app/lib/veo/generate.ts` | ACTIVE SECONDARY | `/api/veo/generate`；T2VWorkbench | `batchResults` | 是（t2v 素材） | 非剪辑 render |
| consistency-engine | `app/lib/consistency-engine/` | ACTIVE SECONDARY | shot-frame API；batch images | 生图 prompt/QC | 是（间接） | 不碰 timeline |
| Voice/Subtitle/Music/Effect Center | `app/components/*-center/` + `app/api/*-center/` | ACTIVE SECONDARY | 各 Center Shell | `editGraph` patch 回 workbench | 部分（经 render） | 共享 auto-edit 内核 |

---

## LEGACY ACTIVE（标记旧但仍被调用）

| 模块 | 文件路径 | 分类 | 真实调用方 | 证据 |
|------|---------|------|-----------|------|
| EditSequence | `app/lib/auto-edit/types.ts` | LEGACY ACTIVE | `graphToSequence`；`/api/auto-edit/render` body.sequence | render API 仍收 sequence 参数 |
| editSequence (state) | `workbench-persist/types.ts` L226 | LEGACY ACTIVE | `patchEditGraph` 同步写入 | 与 editGraph 双存 |
| editPlan (state) | `workbench-persist/types.ts` L230 | LEGACY ACTIVE | `runAutoEditPipeline` workbenchPatch | 镜像进 `editGraph.plans[]` |
| buildCompatImageTasksFromDirector | `app/lib/image-task/build-compat-tasks.ts` | LEGACY ACTIVE | apply 路径无 planned tasks 时 | compat 1:1 shot→task |
| render-timeline.ts | `app/lib/auto-edit/render-timeline.ts` | LEGACY ACTIVE | @deprecated 但可能被旧 import 引用 | 重定向 runRenderEngine |
| consistency (V1) | `app/lib/consistency/` | LEGACY ACTIVE | 部分旧 import | @deprecated → consistency-engine |
| production-json stores | `app/lib/storage/production-json.ts` | LEGACY ACTIVE | 14+ app stores | app 未走 database/repositories |

---

## DEPRECATED ACTIVE（注释废弃，调用未断）

| 模块 | 文件路径 | 分类 | 为何仍被调用 | 证据 |
|------|---------|------|-------------|------|
| runAutoEditPipeline | `app/lib/auto-edit/run-auto-edit-pipeline.ts` L80–84 | DEPRECATED ACTIVE | orchestrator edit 阶段默认路径；AiAutoEditShell 一键剪辑 | @deprecated 指向 runAiCutPipeline |
| unitsToNarrativeShots | `app/lib/narrative/units-to-shots.ts` | DEPRECATED ACTIVE | re-export `directShotsFromUnits` | 兼容 import |
| splitBeatRuleFallback | `app/lib/narrative/generate-shots.ts` | DEPRECATED ACTIVE | 测试脚本 | audit-narrative-shots.ts |

---

## SHADOW（并行模型，非名义 SSOT）

| 模块 | 文件路径 | 分类 | 与主系统关系 | 证据 |
|------|---------|------|-------------|------|
| DirectorPlan | `app/lib/director-plan/types.ts` | SHADOW | AI Cut 大脑层；有 graph 时由 `editGraphToDirectorPlan` 反推 | run-pipeline.ts L79–84 |
| openCutCommands | `workbench-persist/types.ts` L234 | SHADOW | Clip Agent 输出；不驱动 FFmpeg | clip-agent/execute.ts |
| AiTimelineSpec | `app/lib/opencut/timeline-spec.ts` | SHADOW | export-project JSON 桥接 | 不参与 render |
| RenderTimeline | `app/lib/auto-edit/render-engine/types.ts` | SHADOW | 瞬时；每次 render 重建 | 不持久化 |
| storyboard.duration vs timeline.durationSec | 跨模块 | SHADOW | 编导层 vs 剪辑层双份时长 | buildEditInputFromWorkbench 分裂 |
| shotDurationSec | `t2v-store.ts` | SHADOW | 全局兜底时长；t2i 剪辑链误用为 per-shot | workbench-bridge.ts L34 |

---

## PARTIAL INTEGRATION（半接入）

| 模块 | 文件路径 | 分类 | 状态 | 证据 |
|------|---------|------|------|------|
| OpenCut vendor | `scripts/opencut-zh/setup.sh` + iframe | PARTIAL INTEGRATION | Docker UI 可嵌入；无 programmatic export | OpenCutEditorEmbed.tsx |
| executeOpenCutCommands | `app/lib/opencut/client.ts` | PARTIAL INTEGRATION | 内存快照；exportVideo skipped | client.ts L96–101 |
| database/repositories | `database/repositories/` | PARTIAL INTEGRATION | PG 层就绪；`app/` 未调用 getRepositoryBundle | grep 0 matches in app |
| dual-write | `database/repositories/dual-write/` | PARTIAL INTEGRATION | `dualWriteEnabled: false` | config.ts |

---

## ADAPTER（翻译层，非决策）

| 模块 | 文件路径 | 分类 | 作用 | 证据 |
|------|---------|------|------|------|
| editGraphToDirectorPlan | `app/lib/director-plan/adapters.ts` | ADAPTER | EditGraph → DirectorPlan | ai-cut/run-pipeline.ts |
| directorPlanToOpenCutCommands | `app/lib/clip-agent/plan-to-commands.ts` | ADAPTER | Plan → Commands | runClipAgent |
| editGraphToOpenCutProject | `app/lib/opencut/project-bridge.ts` | ADAPTER | Graph → JSON 工程 | export-project route |
| graphToSequence | `app/lib/auto-edit/edit-graph/timeline-bridge.ts` | ADAPTER | Graph → EditSequence | render 入参 |
| sequenceToTimeline | 同上 | ADAPTER | Sequence → EditTimeline | migrate/refresh |
| buildDirectorWorkbenchPatch | `app/lib/director/apply-director-response.ts` | ADAPTER | API JSON → workbench | 与 pipeline apply 并行 |

---

## DEAD CANDIDATE（代码存在，未进主链或桩实现）

| 模块 | 文件路径 | 分类 | 证据 |
|------|---------|------|------|
| requestOpenCutExport | `app/lib/opencut/project-bridge.ts` L94–104 | DEAD CANDIDATE | 直接返回失败，指向 FFmpeg |
| OpenCut exportVideo command | `app/lib/opencut/client.ts` | DEAD CANDIDATE | status: "skipped" |
| Remotion | 全库搜索 | DEAD CANDIDATE | 无 remotion 依赖与 import |
| getRepositoryBundle in app | `database/repositories/factory.ts` | DEAD CANDIDATE | app 层零调用 |
| loadJson (workbench localStorage) | `app/lib/workbench-persist/storage.ts` | DEAD CANDIDATE | 恒返回 null |
| render-timeline 旧入口 | `app/lib/auto-edit/render-timeline.ts` | DEAD CANDIDATE | @deprecated 兼容 |

---

## 生产主链简图（ACTIVE only）

```
用户输入 / Workbench
  → runDirectorPipeline [PRIMARY]
  → apply*ToWorkbench
  → runBatchShotImages (可选)
  → runAutoEditPipeline [PRIMARY edit, deprecated 标注]
  → editGraph [名义 SSOT]
  → graphToSequence [ADAPTER]
  → /api/auto-edit/render
  → runRenderEngine [PRIMARY render]
  → finalEditVideoUrl (MP4)

并行影子链（不产出 MP4）:
  editGraph → runAiCutPipeline → DirectorPlan → openCutCommands → executeOpenCutCommands (ADAPTER/MOCK)
```
