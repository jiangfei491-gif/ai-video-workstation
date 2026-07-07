# AI VIDEO WORKSTATION 控制权审计

> 审计日期：2026-06-29  
> 范围：`ai-video-workstation` 全项目源码（只读）  
> 方法：入口追踪 → 调用链 → 字段写入 → 最终 FFmpeg 消费者  
> **本报告未修改任何源码。**

---

## 1. 执行摘要

当前 AI 视频生产链存在**多条并行权威路径**，名义上的 Single Source of Truth（`EditGraph.timeline`）与真实渲染输入（`EditSequence` → `RenderTimeline` → FFmpeg）之间经过多次 adapter 转换，且**时长规划层与剪辑输入层在 t2i 模式下断裂**。

| 控制权 | 结论 |
|--------|------|
| 导演决策 | **CONFLICTED** — 生成权威在 `runDirectorPipeline`，但两条 apply 路径写回不一致 |
| 镜头定义 | **CONFIRMED** — `runDirectorPipeline`（t2i: `directShotsFromUnits`；t2v: GPT storyboard） |
| 时间 | **CONFLICTED** — `planNarrativeDuration` 设计 vs `shotDurationSec` 剪辑链实际读取 |
| 剪辑规划 | **CONFLICTED** — `runAutoEditPipeline`（deprecated 仍活跃）与 `runAiCutPipeline` 并行 |
| 时间线 | **CONFLICTED** — EditGraph 名义 SSOT，Render 吃 EditSequence 瞬时模型 |
| 配音时间 | **CONFLICTED** — TTS 可拉长 timeline，不回写 render segments |
| 字幕时间 | **MEDIUM** — Center + auto-edit API 双写 `editGraph.timeline.subtitle` |
| 音乐时间 | **LOW** — `editGraph.timeline.music` 独立轨 |
| 特效 | **LOW** — render 阶段 FFmpeg filter，不改持久 timeline |
| 最终渲染 | **CONFIRMED** — `runRenderEngine` + FFmpeg 为唯一 MP4 产出 |
| OpenCut | **ADAPTER ONLY** — 无 programmatic MP4；export 桩实现 |
| Workbench | **God State** — 80+ 字段跨领域集中 |
| 持久化 | **DUAL** — PG session + Workspace JSON 双世界 |

---

## 2. 当前真实生产主链

### ACTIVE PRODUCTION PATH（已确认）

从用户操作到最终 MP4 的**主链**如下（t2i 图文模式为最完整路径）：

#### STEP 01 — 用户输入 / Workbench State

- **模块**：Workbench UI  
- **文件**：`app/components/workflows/t2v/T2VWorkbench.tsx`  
- **函数**：`startDirectorRun` / `startAiDirectorRun`  
- **输入**：`T2VWorkbenchState`（script、targetDurationMinutes、shotDurationSec、outputMode）  
- **输出**：HTTP POST body  
- **写入**：无（发起请求）  
- **下一调用**：`/api/director` 或 `/api/ai-director/run`  
- **控制权类型**：PROJECT

#### STEP 02 — Director API 入口

- **模块**：Director Route  
- **文件**：`app/api/director/route.ts`  
- **函数**：`POST` handler  
- **输入**：workbench snapshot  
- **输出**：`DirectorResponse` JSON  
- **写入**：无（无状态 API）  
- **下一调用**：`runDirectorPipeline` → `buildDirectorWorkbenchPatch`  
- **控制权类型**：DIRECTOR

#### STEP 03 — AI Director 一键入口

- **模块**：AI Director Orchestrator  
- **文件**：`app/lib/ai-director/run-orchestrator.ts`  
- **函数**：`runAiDirectorOrchestrator`  
- **输入**：`AiDirectorRunRequest`  
- **输出**：`workbenchPatch` 多阶段  
- **写入**：经 `applyDirectorPipelineToWorkbench` 写 workbench  
- **下一调用**：director → media → edit → render 各阶段  
- **控制权类型**：DIRECTOR

#### STEP 04 — 导演管线（决策核心）

- **模块**：Director Pipeline  
- **文件**：`app/lib/director/run-director-pipeline.ts`  
- **函数**：`runDirectorPipeline`  
- **输入**：script、outputMode、targetDurationMinutes、narrativeBeats（可选）  
- **输出**：`DirectorPipelineResult`（storyboard、narrativeBeats、imageTasks、duration plan）  
- **写入**：内存结果（尚未写 workbench）  
- **下一调用**：t2i → `generateNarrativeStoryboard` → `splitNarrativeShots` → `planNarrativeDuration`  
- **控制权类型**：DIRECTOR / NARRATIVE / SHOT / DURATION

#### STEP 05 — 叙事分镜生成（t2i）

- **模块**：Narrative Shot Pipeline  
- **文件**：`app/lib/narrative/generate-shots.ts`  
- **函数**：`generateShotsForBeat` → `directShotsFromUnits`  
- **输入**：`NarrativeBeat`、VisualActionUnit  
- **输出**：`NarrativeShot[]` → 合并进 `storyboard`  
- **写入**：pipeline 内存  
- **下一调用**：`planNarrativeDuration`  
- **控制权类型**：NARRATIVE / SHOT

#### STEP 06 — 时长规划（t2i 设计层）

- **模块**：Duration Planner  
- **文件**：`app/lib/director/duration/plan-narrative-duration.ts`  
- **函数**：`planNarrativeDuration`  
- **输入**：beats、shots、targetDurationMinutes  
- **输出**：`storyboard[].duration` per-shot  
- **写入**：pipeline 内 storyboard 字段  
- **下一调用**：apply 路径写回 workbench  
- **控制权类型**：DURATION

#### STEP 07 — Apply 写回 Workbench（分叉点）

- **路径 A**：`app/lib/director/apply-director-response.ts` → `buildDirectorWorkbenchPatch`  
  - 保留 `planNarrativeDuration` 的 per-shot duration  
- **路径 B**：`app/lib/ai-director/apply-pipeline-result.ts` → `applyDirectorPipelineToWorkbench`  
  - t2i 时**全部覆盖**为 `state.shotDurationSec`  
- **写入**：`director.storyboard`、`narrativeBeats`、`imageTasks`  
- **控制权类型**：DIRECTOR / DURATION（冲突）

#### STEP 08 — 批量生图

- **模块**：Batch Images  
- **文件**：`app/lib/ai-director/run-batch-images.ts`  
- **函数**：`runBatchShotImages`  
- **输入**：storyboard、imageTasks  
- **输出**：`shotFrames` / `imageTaskFrames`  
- **写入**：workbench frames  
- **下一调用**：auto-edit  
- **控制权类型**：MEDIA TASK / IMAGE

#### STEP 09 — 自动剪辑编排

- **模块**：Auto Edit Pipeline  
- **文件**：`app/lib/auto-edit/run-auto-edit-pipeline.ts`  
- **函数**：`runAutoEditPipeline`（@deprecated，仍被 orchestrator 调用）  
- **输入**：`buildEditInputFromWorkbench(state)`  
- **输出**：`editGraph`、`editPlan`、`editSequence`  
- **写入**：workbench edit 字段  
- **下一调用**：`refreshEditGraphFromWorkbench`（分镜变更时）  
- **控制权类型**：EDIT / TIMELINE

#### STEP 10 — 剪辑输入桥接（时长断裂点）

- **模块**：Workbench Bridge  
- **文件**：`app/lib/auto-edit/workbench-bridge.ts`  
- **函数**：`buildEditInputFromWorkbench`  
- **输入**：workbench state  
- **输出**：`EditInput`（clips with durationSec）  
- **关键**：t2i 分支 L34 使用 `shotDurationSec`，**不读** `storyboard[].duration`  
- **控制权类型**：DURATION（覆盖设计层）

#### STEP 11 — EditGraph（名义 SSOT）

- **模块**：Edit Graph  
- **文件**：`app/lib/auto-edit/edit-graph/types.ts`  
- **函数**：graph 构建 / `refreshEditGraphFromWorkbench`  
- **输入**：EditInput、media pool  
- **输出**：`EditGraph.timeline`（clips、transitions、tracks）  
- **写入**：workbench `editGraph`  
- **下一调用**：`graphToSequence`  
- **控制权类型**：TIMELINE / EDIT

#### STEP 12 — 配音（可选，可改时间）

- **模块**：Voice Engine  
- **文件**：`app/lib/auto-edit/audio/ensure-voice-clips.ts`、`align-voice-subtitle.ts`  
- **函数**：`ensureVoiceClips` → `alignTimelineAfterVoiceSynth`  
- **输入**：narration text、TTS provider  
- **输出**：voice clips；可能 `extendVideoToVoiceDuration`  
- **写入**：`editGraph.timeline` / `editTimeline`  
- **注意**：不回写 `RenderTimeline.segments`  
- **控制权类型**：VOICE

#### STEP 13 — 字幕 / 音乐 / 特效（Center 支路）

- **模块**：各 Center API  
- **文件**：`app/api/voice-center/workbench/route.ts` 等  
- **函数**：PATCH workbench  
- **写入**：`editGraph` 子轨  
- **控制权类型**：SUBTITLE / MUSIC / EFFECT

#### STEP 14 — Graph → Sequence 转换

- **模块**：Timeline Bridge  
- **文件**：`app/lib/auto-edit/edit-graph/timeline-bridge.ts`  
- **函数**：`graphToSequence`  
- **输入**：`EditGraph`  
- **输出**：`EditSequence`  
- **控制权类型**：TIMELINE（adapter）

#### STEP 15 — 渲染入口

- **模块**：Render API  
- **文件**：`app/api/auto-edit/render/route.ts`  
- **函数**：`POST`  
- **输入**：workbench state 或 body.sequence  
- **输出**：render job id  
- **下一调用**：`runRenderEngine`  
- **控制权类型**：RENDER

#### STEP 16 — 渲染引擎（最终权威）

- **模块**：Render Engine  
- **文件**：`app/lib/auto-edit/render-engine/run-render-engine.ts`  
- **函数**：`runRenderEngine`  
- **输入**：`EditSequence` → `buildRenderTimeline`  
- **输出**：MP4 文件路径  
- **写入**：`finalEditVideoUrl`  
- **执行**：FFmpeg（`build-ffmpeg-commands.ts`）  
- **控制权类型**：RENDER

### 并行影子链（不产出 MP4）

```
editGraph → runAiCutPipeline → editGraphToDirectorPlan → runClipAgent
  → openCutCommands → executeOpenCutCommands (内存快照, export skipped)
```

---

## 3. 导演控制权

### DIRECTOR AUTHORITY OWNER

**生成权威**：`runDirectorPipeline`（`app/lib/director/run-director-pipeline.ts`）

- t2i：`generateNarrativeStoryboard` → `splitNarrativeShots` → `directShotsFromUnits`
- t2v：`generateStoryboard`（GPT）

### 入口对照

| 入口 | 文件 | 第一层调用 | 最终执行 |
|------|------|-----------|---------|
| AI Director 一键 | `AiDirectorShell` → `/api/ai-director/run` | `runAiDirectorOrchestrator` | `runDirectorPipeline` + `applyDirectorPipelineToWorkbench` |
| 普通 Director | `T2VWorkbench` → `/api/director` | `runDirectorPipeline` | `buildDirectorWorkbenchPatch` |
| 口播 | `/api/auto-edit/spoken-narration` | `applySpokenNarrationsToStoryboard` | 仅改 narration 字段 |

### DIRECTOR SECONDARY WRITERS

- `buildDirectorWorkbenchPatch` / `applyDirectorPipelineToWorkbench`（双 apply）
- `T2VWorkbench.deleteShots` / `reorderShots`（用户）
- `applySpokenNarrationsToStoryboard`（口播文本）

### DIRECTOR OVERRIDE PATHS

1. **双 apply 路径**：普通 API 保留 per-shot duration；AI Director apply 覆盖为 `shotDurationSec`
2. **用户删镜/排序**：直接改 `director.storyboard` 数组
3. **Compat image tasks**：无 planned tasks 时 `buildCompatImageTasksFromDirector` 补 shotId

### 回答问题

1. **AI Director 一键真正入口**：`POST /api/ai-director/run` → `runAiDirectorOrchestrator`
2. **普通 Director 是否同路径**：生成相同（`runDirectorPipeline`），**写回不同**（两条 apply）
3. **是否存在两套 apply**：**是**
4. **同 pipeline 输出是否因入口不同写回不同**：**是**（duration 字段）
5. **谁最终决定 Narrative Shot**：`directShotsFromUnits`（经 `runDirectorPipeline`）
6. **生成后谁可再改**：用户 UI、口播 API（narration）、删镜排序
7. **Director Authority 冲突**：**存在**（apply 分叉 + 剪辑链不读 director duration）

---

## 4. 时间控制权

### DURATION AUTHORITY OWNER（分裂）

| 层级 | 权威 | 字段 |
|------|------|------|
| 设计层（t2i） | `planNarrativeDuration` | `storyboard[].duration` |
| 剪辑输入层 | `buildEditInputFromWorkbench` | 统一 `shotDurationSec` |
| 持久剪辑层 | `EditGraph.timeline.clips[].durationSec` | graph |
| 渲染层 | `buildRenderTimeline` | `RenderTimeline.segments[].durationSec` |
| 混音总时长 | `resolveAudioMixDurationSec` | max(video, voice) |

### DURATION SECONDARY WRITERS

- `applyDirectorPipelineToWorkbench`（覆盖 planner 输出）
- `refreshEditGraphFromWorkbench`（指纹不匹配时重建，否则**保留旧 clip 时长**）
- `ensureVoiceClips` + `alignTimelineAfterVoiceSynth`（拉长 video 轨）
- `generateEditPlan`（GPT 建议镜长）
- UI `updateTimelineClipDuration`

### DURATION OVERRIDE PATHS

1. AI Director apply → shotDurationSec 覆盖 storyboard.duration
2. workbench-bridge t2i → 忽略 per-shot duration
3. voice align → extendVideoToVoiceDuration，不回写 render segments
4. refreshGraph stale 仅比指纹 → 保留旧 timeline order/duration

### FINAL RENDER DURATION SOURCE

**`EditSequence.clips[].durationSec`**（经 `graphToSequence`）→ `buildRenderTimeline` → FFmpeg `-t` / segment duration

### 回答问题

1. **真正时间规划器**：设计层 `planNarrativeDuration`；**实际剪辑链**用 `shotDurationSec`
2. **Planner 首次写入**：`runDirectorPipeline` 内 storyboard 字段
3. **覆盖者**：apply 路径 B、bridge、refresh 保留、voice align
4. **shotDurationSec ACTIVE 位置**：`buildEditInputFromWorkbench` L34；`applyDirectorPipelineToWorkbench`；UI 设置
5. **T2I 统一固定镜长**：**仍存在**（bridge t2i 分支）
6. **Voice 能否改 Timeline duration**：**能**（extendVideoToVoiceDuration），但不回写 render segments
7. **Subtitle 能否改 Timeline duration**：否（仅字幕轨时间戳）
8. **Render 是否重算 duration**：`buildRenderTimeline` 从 sequence 重建，不读 storyboard
9. **FFmpeg 最终来源**：`RenderTimeline.segments` / clip commands 中的 durationSec

---

## 5. 剪辑控制权

### EDIT AUTHORITY OWNER

**名义**：`EditGraph`（注释 Single Source of Truth）  
**实际决策分裂**：
- 镜头顺序/裁剪：`runAutoEditPipeline` → `generateEditPlan`（GPT）+ `buildEditInputFromWorkbench`
- AI Cut 层：`runAiCutPipeline` → 有 graph 时退化为 `editGraphToDirectorPlan` adapter

### EDIT SECONDARY WRITERS

- `refreshEditGraphFromWorkbench`
- `createPlanVariantFromApi`
- Center workbench API（voice/subtitle/music/effect）
- `CanvasEditShell` 手动改轨

### AI CUT REAL ROLE

**Adapter / Translator**：当 `editGraph` 已存在，`runAiCutPipeline` 调用 `editGraphToDirectorPlan` 反推 `DirectorPlan`，再生成 `openCutCommands`。**不独立决定最终 FFmpeg 剪辑**。

### AUTO EDIT REAL ROLE

**ACTIVE PRIMARY** for edit orchestration：尽管标记 `@deprecated`，`runAiDirectorOrchestrator` edit 阶段仍调用 `runAutoEditPipeline`。

### 回答问题

1. **镜头顺序**：`generateEditPlan` + `buildEditInputFromWorkbench` 初始顺序；用户/Center 可改 `editGraph`
2. **镜头裁剪**：`EditGraph.timeline.clips` in/out；render 时 `buildImageSegmentCommand`
3. **Transition**：`generateEditPlan` / `applyDefaultTransitionsToTimeline` / UI
4. **Motion**：render 阶段静态图 Ken Burns；`storyboard.camera` 仅 hint，未完整进入 motion resolver
5. **Auto Edit 仍在 ACTIVE path**：**是**
6. **runAutoEditPipeline deprecated**：**是**（注释），**仍被调用**
7. **为何仍调用**：orchestrator 默认 edit 阶段未切换到纯 ai-cut
8. **AI Cut v3 独立决策**：**否**（有 graph 时反推）
9. **从 EditGraph 反推 DirectorPlan**：**是**
10. **OpenCut Commands 影响 FFmpeg**：**否**

---

## 6. 时间线控制权

### TIMELINE MODEL INVENTORY

| 名称 | 定义文件 | 生产者 | 消费者 | 持久化 | 进最终 Render | 可改时间 | 可改顺序 |
|------|---------|--------|--------|--------|--------------|---------|---------|
| EditGraph | `edit-graph/types.ts` | runAutoEditPipeline, refresh | graphToSequence, Centers | workbench | 间接 | 是 | 是 |
| EditSequence | `auto-edit/types.ts` | graphToSequence | /api/auto-edit/render | workbench 镜像 | **是** | 经 graph | 经 graph |
| EditTimeline | `edit-graph/types.ts` | sequenceToTimeline | voice align | editGraph 内 | 间接 | 是 | 是 |
| DirectorPlan | `director-plan/types.ts` | runAiCutPipeline, adapter | clip-agent, opencut | workbench | 否 | 是 | 是 |
| AiTimelineSpec | `opencut/timeline-spec.ts` | editGraphToTimelineSpec | export-project | 否 | 否 | — | — |
| OpenCutProjectPayload | `opencut/project-bridge.ts` | editGraphToOpenCutProject | iframe UI | 否 | 否 | — | — |
| RenderTimeline | `render-engine/types.ts` | buildRenderTimeline | runRenderEngine | 否（瞬时） | **是** | 否（派生） | 否 |

### TIMELINE CONVERSION GRAPH

```
storyboard + media
  → buildEditInputFromWorkbench
  → runAutoEditPipeline
  → EditGraph
  → graphToSequence → EditSequence
  → buildRenderTimeline → RenderTimeline
  → FFmpeg

EditGraph → editGraphToDirectorPlan → DirectorPlan
DirectorPlan → directorPlanToOpenCutCommands → openCutCommands
EditGraph → editGraphToOpenCutProject → OpenCutProjectPayload
EditGraph → editGraphToTimelineSpec → AiTimelineSpec
```

转换函数文件：
- `app/lib/auto-edit/edit-graph/timeline-bridge.ts`
- `app/lib/director-plan/adapters.ts`
- `app/lib/clip-agent/plan-to-commands.ts`
- `app/lib/opencut/project-bridge.ts`
- `app/lib/opencut/timeline-spec.ts`
- `app/lib/auto-edit/render-engine/build-timeline.ts`

### TIMELINE AUTHORITY OWNER

**名义**：`EditGraph.timeline`  
**实际 Render**：`EditSequence` → `RenderTimeline`（每次 render 重建）

### TIMELINE SHADOW MODELS

- `DirectorPlan` + `openCutCommands`（不渲染）
- `storyboard.duration` vs `clip.durationSec`（双份时长）
- `editSequence` workbench 镜像（派生但持久）

### TIMELINE INFORMATION LOSS POINTS

1. `buildEditInputFromWorkbench`：丢失 per-shot `storyboard.duration`
2. `graphToSequence`：可能丢失 narrative beat 元数据
3. `editGraphToDirectorPlan`：反推时 camera/narrative intent 简化
4. `buildRenderTimeline`：motion/narrative 字段不进入 FFmpeg segment

---

## 7. Workbench State

### WORKBENCH STATE DOMAIN MAP（字段统计近似）

| 领域 | 代表字段 | 约字段数 |
|------|---------|---------|
| PROJECT | projectId, title, outputMode | 5 |
| SCRIPT | script, scriptSections | 3 |
| DIRECTOR | director.storyboard, directorRunId | 8 |
| NARRATIVE | narrativeBeats | 2 |
| DURATION | targetDurationMinutes, shotDurationSec | 2 |
| IMAGE | imageTasks, shotFrames, imageTaskFrames | 6 |
| VIDEO | batchResults, veoSettings | 4 |
| VOICE | voiceProvider, voicePreset | 4 |
| SUBTITLE | subtitleStyle, subtitleLang | 3 |
| MUSIC | bgmUrl, bgmVolume | 3 |
| EFFECT | effectPreset | 2 |
| EDIT | editGraph, editPlan, editSequence | 6 |
| TIMELINE | editGraph.timeline.* | 嵌套 |
| QC | imageTaskTimeline, qaFlags | 3 |
| RENDER | finalEditVideoUrl, renderJobId | 4 |
| EXPORT | exportSettings | 2 |
| UI | panelState, selectedShotId | 5 |
| COST | costBreakdown | 2 |
| CANVAS | canvasNodes | 3 |
| ASSET | assetRefs | 2 |

### WORKBENCH STATE WRITERS（主要）

| 模块 | 文件 | 函数 | 写入字段 |
|------|------|------|---------|
| Director Apply A | apply-director-response.ts | buildDirectorWorkbenchPatch | director.*, narrativeBeats, imageTasks |
| Director Apply B | apply-pipeline-result.ts | applyDirectorPipelineToWorkbench | 同上 + duration 覆盖 |
| Auto Edit | run-auto-edit-pipeline.ts | workbenchPatch | editGraph, editPlan, editSequence |
| AI Cut | run-pipeline.ts | workbenchPatch | directorPlan, openCutCommands |
| Voice Center | voice-center/workbench | PATCH | editGraph.timeline.voice |
| Subtitle Center | subtitle-center/workbench | PATCH | editGraph.timeline.subtitle |
| Render API | auto-edit/render/route.ts | 响应写回 | finalEditVideoUrl, renderJob |
| T2V Store | t2v-store.ts | setT2VState / patch | 任意 Partial |

### 回答问题

1. **是否 God State**：**是**（80+ 字段，跨全链路）
2. **谁直接改整个 state**：orchestrator apply、Center PATCH、用户 UI patch
3. **跨领域写入**：**是**（edit 写 graph 含 voice/subtitle/music）
4. **多模块写字段**：editGraph、director.storyboard、duration 相关
5. **派生但持久**：editSequence、directorPlan（反推）、openCutCommands

---

## 8. Center 边界

### CENTER DEPENDENCY MATRIX（摘要）

| Center | import auto-edit | import edit-graph | 可改 Timeline | 自有时间模型 |
|--------|-----------------|-------------------|--------------|-------------|
| Voice Center | 是 | 是 | 是（voice 轨） | 否 |
| Subtitle Center | 是 | 是 | 是（subtitle 轨） | 否 |
| Music Center | 是 | 是 | 是（music 轨） | 否 |
| Effect Center | 是 | 是 | 部分（effect 元数据） | 否 |
| QA Center | 部分 | 否 | 否 | 否 |
| Material Center | 否 | 否 | 否 | 否 |
| Asset Library | 否 | 否 | 否 | 否 |

### CENTER BOUNDARY VIOLATIONS

- 各 Media Center **直接 import** `app/lib/auto-edit/*` 内部模块
- Center API **整包写回** `editGraph`，与 `runAutoEditPipeline` 竞争 LAST WRITER WINS

### HIDDEN PLATFORM CORE

**`app/lib/auto-edit/`** 已成为事实上的隐藏平台内核：edit-graph、render-engine、workbench-bridge、各 engine 被 Director、AI Director、Centers、Canvas 共同依赖。

### CROSS-CENTER DEPENDENCY PATHS

```
T2VWorkbench → auto-edit/workbench-bridge → runAutoEditPipeline
Centers → *-center/workbench → editGraph patch
CanvasEditShell → refreshEditGraphFromWorkbench → editGraph
AI Director → orchestrator → auto-edit + ai-cut + render
```

---

## 9. OpenCut 真实状态

### OPENCUT INTEGRATION STATUS: **ADAPTER ONLY**

| 问题 | 答案 | 证据 |
|------|------|------|
| 真实调用 OpenCut runtime | 否 | 无 Node 侧 runtime invoke |
| 真实调用 OpenCut API | 否 | 无 HTTP 到 OpenCut export |
| HTTP 调用 | 仅 bootstrap/status/resolve-editor-url | `app/api/opencut/*` |
| postMessage | iframe 嵌入 | `OpenCutEditorEmbed.tsx` |
| IPC | 否 | — |
| vendor direct invocation | 否（Docker UI only） | `scripts/opencut-zh/setup.sh` |
| executeOpenCutCommands 执行 | 内存状态快照；exportVideo skipped | `opencut/client.ts` L96–101 |
| OpenCutProject | 内存/JSON 桥接 | `project-bridge.ts` |
| export 真正导出视频 | 否 | `requestOpenCutExport` 返回失败 |
| 参与最终 production render | 否 | render 走 FFmpeg |

---

## 10. 最终渲染控制权

### FINAL RENDER AUTHORITY

**`runRenderEngine`**（`app/lib/auto-edit/render-engine/run-render-engine.ts`）

### FINAL VIDEO GENERATION PATH

```
POST /api/auto-edit/render
  → validate assets
  → graphToSequence (或 body.sequence)
  → buildRenderTimeline
  → buildFfmpegCommands (clip / transition / audio mix / ASS burn-in)
  → spawn FFmpeg
  → output MP4 → finalEditVideoUrl
```

### RENDER SECONDARY DECISION MAKERS

- `ensureVoiceClips`（先改 timeline 再 render）
- `buildRenderPlan` 内 validate
- `buildImageSegmentCommand`（Ken Burns 参数）
- `buildTransitionMergeCommand`
- `buildAudioMixCommand`（BGM ducking）
- `buildAssContent`（字幕烧录）

### MULTIPLE RENDER PATHS

| 路径 | 状态 |
|------|------|
| FFmpeg via runRenderEngine | **ACTIVE** — 唯一 MP4 |
| OpenCut exportVideo | **DEAD** — skipped |
| Remotion | **不存在** |
| requestOpenCutExport | **桩** — 指向 FFmpeg |

### 回答问题

1. **最终 Render Authority**：`runRenderEngine`
2. **FFmpeg 角色**：执行器 + 部分业务决策（segment 模式、转场、混音、烧录）
3. **ShotMotionResolver 重解释 Director**：静态图 Ken Burns 未完整映射 director camera 意图
4. **Render 重算 Timeline**：是（每次 `buildRenderTimeline` 从 sequence 重建）
5. **OpenCut 参与最终 Render**：否
6. **Remotion**：不存在
7. **多 Render Path**：仅 FFmpeg 活跃；OpenCut 为死路径

---

## 11. 数据库存储控制权

### PERSISTENCE DOMAIN MAP

| 领域 | PostgreSQL | JSON (Workspace) | File Store | Memory | 真实生产使用 |
|------|-----------|------------------|------------|--------|-------------|
| Workbench UI | workbench_sessions | — | — | t2v-store | **PG** |
| Project | schema 有 | production-json | — | — | **JSON** |
| Asset/Resource | schema 有 | asset stores | files/ API | — | **JSON + files** |
| Director/Narrative | — | 在 workbench PG | — | — | **PG (ui_state)** |
| ImageTask | — | image-task store | — | — | **JSON** |
| EditGraph | — | 在 workbench PG | — | — | **PG** |
| Edit Jobs | — | edit-job-store | workspace | — | **JSON** |
| Render/Export | — | 在 workbench | output/ | — | **PG + files** |
| History | schema 有 | history store | — | — | **JSON** |
| Materials | — | materials store | — | — | **JSON** |

### PRIMARY PERSISTENCE AUTHORITY

- **UI 会话状态**：PostgreSQL `workbench_sessions.ui_state`
- **业务实体**：Workspace `production-json` 文件
- **database/repositories**：已实现但 **app 层未接入**

### DUAL PERSISTENCE CONFLICTS

1. Workbench 在 PG，characters/materials 在 JSON，无统一事务
2. `getRepositoryBundle` 零 app 调用 vs 完整 PG schema 存在
3. `dualWriteEnabled: false` — 双写基础设施未启用

---

## 12. 旧系统与影子架构

详见 `SHADOW_ARCHITECTURE_MAP.md`。

要点：
- **LEGACY ACTIVE**：EditSequence、editPlan、production-json stores、compat image tasks
- **DEPRECATED ACTIVE**：runAutoEditPipeline（orchestrator 仍调）
- **SHADOW**：DirectorPlan、openCutCommands、双份 duration
- **ADAPTER ONLY**：OpenCut 全栈
- **DEAD CANDIDATE**：Remotion、PG repositories in app、OpenCut export

---

## 13. 十大最高风险控制权冲突

按 CRITICAL → HIGH 排序：

| # | 冲突 | 等级 | 说明 |
|---|------|------|------|
| 1 | Duration 设计层 vs 剪辑输入层断裂 | **CRITICAL** | planNarrativeDuration 写 storyboard.duration，bridge 读 shotDurationSec |
| 2 | 双持久化世界（PG session vs JSON entities） | **CRITICAL** | 无统一状态权威，跨模块一致性无保障 |
| 3 | EditGraph 名义 SSOT vs EditSequence 实际 Render 输入 | **CRITICAL** | 多次 adapter 转换，信息丢失 |
| 4 | 双 Director Apply 路径写回不一致 | **HIGH** | 同 pipeline 不同入口不同 duration 语义 |
| 5 | runAutoEditPipeline deprecated 仍为主 edit 路径 | **HIGH** | 名义迁移 ai-cut，实际 orchestrator 未切换 |
| 6 | Voice TTS 拉长 timeline 不回写 render segments | **HIGH** | 音视频时长可能不同步 |
| 7 | Center 整包写回 editGraph 竞争 LAST WRITER WINS | **HIGH** | 与 auto-edit pipeline 并行写 |
| 8 | refreshEditGraphFromWorkbench 保留旧 clip 时长 | **HIGH** | 分镜指纹变更时 order 重建但 duration 可能陈旧 |
| 9 | AI Cut 反推 DirectorPlan 退化 adapter | **HIGH** | 名义独立剪辑大脑，实际翻译层 |
| 10 | auto-edit 成为隐藏平台内核 | **HIGH** | Centers/Director/Canvas 全部依赖，边界模糊 |

---

## 14. 当前真正核心资产

（源码已证明存在且进入主链）

1. **Narrative Shot Pipeline** — `directShotsFromUnits`、VisualAction 分解
2. **planNarrativeDuration** — t2i 叙事时长规划（设计层）
3. **runDirectorPipeline** — 统一编导生成
4. **runAiDirectorOrchestrator** — 一键多阶段编排
5. **EditGraph v2** — 剪辑状态聚合（clips/transitions/tracks）
6. **graphToSequence + buildRenderTimeline** — 渲染前转换链
7. **runRenderEngine + FFmpeg** — 唯一成片产出
8. **consistency-engine** — 生图一致性与 QC
9. **Voice/Subtitle/Music engines** — 各轨 derive + render 烧录/混音
10. **Workbench PG session** — UI 状态持久化

---

## 15. 架构收口候选方向

> **仅候选，禁止本阶段实施。**

### 方向 1：统一 Duration 权威

- **当前问题**：planNarrativeDuration vs shotDurationSec vs clip.durationSec 三套
- **涉及模块**：plan-narrative-duration、workbench-bridge、apply-pipeline-result、refresh-graph
- **建议唯一负责人**：`planNarrativeDuration` 输出 → 直连 `buildEditInputFromWorkbench`
- **需退出控制权**：bridge 内 shotDurationSec 统一镜长逻辑；apply 路径 B 的 duration 覆盖
- **风险**：破坏现有固定镜长 UI 预期
- **影响范围**：Director apply、Auto Edit、Render 全链

### 方向 2：单一 Timeline SoT 直达 Render

- **当前问题**：EditGraph → EditSequence → RenderTimeline 三次转换
- **涉及模块**：timeline-bridge、render route、types 镜像字段
- **建议唯一负责人**：`EditGraph.timeline` 直连 `buildRenderTimeline`
- **需退出控制权**：workbench `editSequence` 持久镜像
- **风险**：API 兼容性、旧 UI 依赖 sequence
- **影响范围**：Render API、Workbench types、Centers

### 方向 3：合并 Director Apply 路径

- **当前问题**：buildDirectorWorkbenchPatch vs applyDirectorPipelineToWorkbench
- **建议唯一负责人**：单一 `applyDirectorResult(state, result, options)`
- **需退出控制权**：其中一条 apply 文件
- **风险**：AI Director 与普通 Director 行为变更需产品确认
- **影响范围**：/api/director、/api/ai-director/run

### 方向 4：Orchestrator Edit 阶段切换到 AI Cut 或纯 Graph Refresh

- **当前问题**：deprecated runAutoEditPipeline 仍为主路径
- **建议唯一负责人**：`refreshEditGraphFromWorkbench` + 可选 `runAiCutPipeline` plan 层
- **需退出控制权**：runAutoEditPipeline 在 orchestrator 的调用
- **风险**：GPT edit plan 能力丢失需评估
- **影响范围**：run-orchestrator、AiAutoEditShell

### 方向 5：Voice Align 回写 Render 输入

- **当前问题**：TTS 拉长不回写 segments
- **建议唯一负责人**：align 后同步 `EditGraph.clips[].durationSec` 并触发 graph→sequence
- **需退出控制权**：仅改 editTimeline 不回写路径
- **风险**：重跑 render 成本
- **影响范围**：ensure-voice-clips、align-voice-subtitle、render-engine

### 方向 6：持久化单一世界

- **当前问题**：PG session + JSON entities 分裂
- **建议唯一负责人**：选定 PG 或 JSON 其一为主，另一为缓存/索引
- **需退出控制权**：未接入的 repository 层或 production-json 之一
- **风险**：迁移数据、 downtime
- **影响范围**：全项目存储

### 方向 7：Center 边界 — Facade API

- **当前问题**：Centers 直接 import auto-edit 内部
- **建议唯一负责人**：`app/lib/edit-facade/` 对外稳定 API
- **需退出控制权**：Center 对 edit-graph 直接 import
- **风险**：重构面大
- **影响范围**：所有 *-center 模块

### 方向 8：OpenCut 明确定位

- **当前问题**：半接入造成「似有二套编辑器」错觉
- **建议**：文档化 ADAPTER ONLY；或完全移除 export 死代码路径（未来阶段）
- **需退出控制权**：executeOpenCutCommands 若不做预览可降级
- **风险**：低（当前不参与 render）
- **影响范围**：opencut/*、ai-cut clip-agent

---

## 附录：入口清单

| 入口 | 文件 | 函数 |
|------|------|------|
| AI Director 一键 | `app/api/ai-director/run/route.ts` | POST → runAiDirectorOrchestrator |
| Director API | `app/api/director/route.ts` | POST → runDirectorPipeline |
| Auto Edit | `app/api/auto-edit/auto-pipeline/route.ts` | runAutoEditPipeline |
| AI Cut | `app/api/ai-cut/pipeline/route.ts` | runAiCutPipeline |
| Render | `app/api/auto-edit/render/route.ts` | runRenderEngine |
| Export | `app/api/auto-edit/export/route.ts` | 文件导出 |
| Voice/TTS | `app/api/auto-edit/synthesize-voice/route.ts` | ensureVoiceClips |
| Subtitle | `app/api/auto-edit/subtitles/route.ts` | subtitle engine |
| Music | `app/api/auto-edit/recommend-bgm/route.ts` | music engine |
| Batch Image | orchestrator / `run-batch-images.ts` | runBatchShotImages |
| Batch Video | `/api/veo/generate` | veo generate |
| QC | consistency-engine APIs | score-qc |
| Workbench Session | `app/api/workbench/session/route.ts` | PG persist |

---

*审计完成。详见同目录 `AUTHORITY_CONFLICT_MATRIX.md`、`SHADOW_ARCHITECTURE_MAP.md`、`STATE_FIELD_OVERRIDE_MAP.md`。*
