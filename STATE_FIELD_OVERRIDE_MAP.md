# STATE_FIELD_OVERRIDE_MAP

> 追踪 `T2VWorkbenchState` 及关联持久字段的初始化、写入、覆盖、读取与最终消费者。  
> 标记：**LW** = LAST WRITER WINS；**MA** = MULTIPLE AUTHORITY；**DBP** = DERIVED BUT PERSISTED；**LO** = LEGACY OVERRIDE

---

## storyboard

| 项 | 详情 |
|----|------|
| 定义 | `app/lib/workbench-persist/types.ts` → `director.storyboard: StoryboardShot[]` |
| 初始化 | `createDefaultT2VState`；`runDirectorPipeline` 输出 |
| 写入者 | `buildDirectorWorkbenchPatch`；`applyDirectorPipelineToWorkbench`；`applySpokenNarrationsToStoryboard`；`T2VWorkbench.deleteShots/reorderShots`；`runBatchShotImages`（frames 子字段） |
| 覆盖者 | 两条 apply 路径均可整表覆盖；口播 API 覆盖 `narration`/`spokenNarration` |
| 读取者 | `buildEditInputFromWorkbench`；`refreshEditGraphFromWorkbench`；`runBatchShotImages`；UI StoryboardPanel |
| 最终消费者 | `buildEditInputFromWorkbench` → EditGraph → Render |
| 覆盖顺序 | Director run → apply 路径 → 用户编辑 → 口播 API |
| 标记 | **MA**（双 apply）；**LW**（后一次 director run 或 apply 覆盖） |

---

## storyboard.duration

| 项 | 详情 |
|----|------|
| 定义 | `StoryboardShot.duration?: number` |
| 初始化 | `planNarrativeDuration`（t2i，`runDirectorPipeline` L94–114） |
| 写入者 | `planNarrativeDuration`；`applyDirectorPipelineToWorkbench`（**覆盖为 shotDurationSec**）；`buildDirectorWorkbenchPatch`（**保留 planner 值**） |
| 覆盖者 | apply 路径 #2 在 AI Director 一键运行时覆盖 planner |
| 读取者 | `buildDirectorWorkbenchPatch` 下游；**剪辑链 t2i 不读**（读 shotDurationSec） |
| 最终消费者 | **断裂**：render 用 `EditSequence.clip.durationSec`，来自 graph 非 storyboard.duration |
| 覆盖顺序 | planNarrativeDuration → apply 路径分歧 → refreshGraph 保留旧 clip 时长 |
| 标记 | **MA** + **LO**（bridge 忽略 per-shot duration） |

---

## shotDurationSec

| 项 | 详情 |
|----|------|
| 定义 | `types.ts` L48；默认 3 |
| 初始化 | `createDefaultT2VState` → 3 |
| 写入者 | UI `T2VWorkbench`；`applyDirectorPipelineToWorkbench`（t2i 写回 storyboard 时同源）；`buildEditInputFromWorkbench` 读取 |
| 覆盖者 | 用户改设置；AI Director apply |
| 读取者 | `buildEditInputFromWorkbench` L34（**t2i 分支统一镜长**）；`applyDirectorPipelineToWorkbench` |
| 最终消费者 | `EditSequence.clips[].durationSec`（经 bridge）→ `buildRenderTimeline` |
| 覆盖顺序 | UI 设置 → apply → bridge 固化到所有 clip |
| 标记 | **MA**（与 planNarrativeDuration 竞争）；**LO** |

---

## targetDurationMinutes

| 项 | 详情 |
|----|------|
| 定义 | `types.ts` L47 |
| 初始化 | 默认 1 |
| 写入者 | UI；`runDirectorPipeline` 读取 |
| 覆盖者 | 用户 |
| 读取者 | `planNarrativeDuration`；`runDirectorPipeline` |
| 最终消费者 | 间接经 `storyboard.duration`（若未被 apply 覆盖） |
| 标记 | **DBP**（规划输入，剪辑链未直连） |

---

## narrativeBeats

| 项 | 详情 |
|----|------|
| 定义 | `types.ts` L72 |
| 初始化 | `generateNarrativeStoryboard` |
| 写入者 | `buildDirectorWorkbenchPatch`；`applyDirectorPipelineToWorkbench` |
| 覆盖者 | 每次 director run |
| 读取者 | UI；`splitNarrativeShots` 上游；审计脚本 |
| 最终消费者 | 不直接进入 render（折叠进 storyboard） |
| 标记 | **DBP** |

---

## imageTasks

| 项 | 详情 |
|----|------|
| 定义 | `types.ts` L76 |
| 初始化 | `planImageBudget` 或 `buildCompatImageTasksFromDirector` |
| 写入者 | director apply；`runBatchShotImages` |
| 覆盖者 | compat 路径；新 director run |
| 读取者 | `runBatchShotImages`；`resolveClipMedia` |
| 最终消费者 | 生图 → shotFrames → render 素材 |
| 标记 | **MA**（budget vs compat） |

---

## editSequence

| 项 | 详情 |
|----|------|
| 定义 | `types.ts` L226 |
| 初始化 | `graphToSequence`；`runAutoEditPipeline` workbenchPatch |
| 写入者 | `patchEditGraph` 同步；render API body |
| 覆盖者 | 每次 graph 变更 |
| 读取者 | `/api/auto-edit/render`（可选 body）；legacy UI |
| 最终消费者 | `runRenderEngine`（若 API 传 sequence） |
| 标记 | **DBP**（editGraph 派生镜像）；**LO** |

---

## editGraph

| 项 | 详情 |
|----|------|
| 定义 | `types.ts` L222；`edit-graph/types.ts` |
| 初始化 | `runAutoEditPipeline`；`refreshEditGraphFromWorkbench` |
| 写入者 | `runAutoEditPipeline`；`runAiCutPipeline`（间接）；`refreshEditGraphFromWorkbench`；`*-center/workbench` API；`CanvasEditShell`；`alignTimelineAfterVoiceSynth`（经 timeline 子结构） |
| 覆盖者 | Center API；voice align；用户 timeline 编辑 |
| 读取者 | `graphToSequence`；`editGraphToDirectorPlan`；各 Center |
| 最终消费者 | render（经 sequence 转换） |
| 覆盖顺序 | auto-edit → refresh → center patch → voice align |
| 标记 | **MA**（名义 SSOT，多写入者）；**LW** |

---

## editPlan

| 项 | 详情 |
|----|------|
| 定义 | `types.ts` L230 |
| 初始化 | `generateEditPlan` |
| 写入者 | `runAutoEditPipeline` |
| 覆盖者 | 新 auto-edit run |
| 读取者 | UI PlanComparePanel；镜像 `editGraph.plans[]` |
| 最终消费者 | 间接（plan 影响 graph 构建） |
| 标记 | **DBP** |

---

## directorPlan

| 项 | 详情 |
|----|------|
| 定义 | `types.ts` L238 |
| 初始化 | `runAiCutPipeline` 或 `editGraphToDirectorPlan` |
| 写入者 | `runAiCutPipeline`；adapter 反推 |
| 覆盖者 | 新 ai-cut run；有 graph 时被反推覆盖语义 |
| 读取者 | `runClipAgent`；OpenCut bridge |
| 最终消费者 | `openCutCommands`（不渲染） |
| 标记 | **MA**（生成 vs 反推）；**DBP** |

---

## openCutCommands

| 项 | 详情 |
|----|------|
| 定义 | `types.ts` L234 |
| 初始化 | `runClipAgent` |
| 写入者 | `runAiCutPipeline` |
| 覆盖者 | 新 clip agent run |
| 读取者 | `executeOpenCutCommands` |
| 最终消费者 | 内存快照 only（不 MP4） |
| 标记 | **DBP** |

---

## voice（editGraph.timeline.voice / voiceClips）

| 项 | 详情 |
|----|------|
| 定义 | `edit-graph/types.ts` voice track |
| 初始化 | `ensureVoiceClips` |
| 写入者 | `/api/auto-edit/synthesize-voice`；`voice-center/workbench` |
| 覆盖者 | TTS 重跑；align |
| 读取者 | `buildAudioMixCommand`；`alignTimelineAfterVoiceSynth` |
| 最终消费者 | FFmpeg 混音；**可拉长 timeline 不回写 render segments** |
| 标记 | **MA**；**LW**（voice duration 后于 video clip 规划） |

---

## subtitle

| 项 | 详情 |
|----|------|
| 定义 | `editGraph.timeline.subtitle` |
| 初始化 | `rebuildDerivedTracks`；Whisper align |
| 写入者 | `/api/auto-edit/subtitles`；`subtitle-center/workbench`；`translate-subtitles` |
| 覆盖者 | Center API 整图写回 |
| 读取者 | `buildAssContent` |
| 最终消费者 | FFmpeg ASS 烧录 |
| 标记 | **MA** |

---

## music

| 项 | 详情 |
|----|------|
| 定义 | `editGraph.timeline.music` |
| 初始化 | `injectBgmIntoGraph` |
| 写入者 | `music-center/workbench`；`recommend-bgm`；`upload-bgm` |
| 读取者 | `buildAudioMixCommand` |
| 最终消费者 | FFmpeg BGM 轨 |
| 标记 | LOW conflict |

---

## render（finalEditVideoUrl / renderJob）

| 项 | 详情 |
|----|------|
| 定义 | `types.ts` L250+ |
| 初始化 | `/api/auto-edit/render` 响应 |
| 写入者 | `runRenderEngine` 经 API 写回 workbench |
| 读取者 | ExportPanel；History |
| 最终消费者 | 用户下载 |
| 标记 | 终端字段 |

---

## export

| 项 | 详情 |
|----|------|
| 定义 | ExportPanel state |
| 初始化 | render 完成 |
| 写入者 | `/api/auto-edit/export`；`requestOpenCutExport`（失败桩） |
| 最终消费者 | 文件下载 |
| 标记 | **LO**（OpenCut export 死路径） |

---

## 覆盖顺序总表（关键路径）

```
1. runDirectorPipeline
   └─ planNarrativeDuration → storyboard[].duration  [设计层]

2. apply 分叉
   ├─ buildDirectorWorkbenchPatch → 保留 duration     [普通 Director API]
   └─ applyDirectorPipelineToWorkbench → 覆盖为 shotDurationSec  [AI Director]

3. buildEditInputFromWorkbench (t2i)
   └─ 读 shotDurationSec，忽略 storyboard.duration    [剪辑输入断裂]

4. runAutoEditPipeline / refreshEditGraphFromWorkbench
   └─ EditGraph.timeline.clips[].durationSec          [可能保留旧值]

5. ensureVoiceClips + alignTimelineAfterVoiceSynth
   └─ 改 editTimeline.video，不改 RenderTimeline       [TTS 后覆盖]

6. graphToSequence → buildRenderTimeline → FFmpeg
   └─ clip.durationSec 为最终成片 segment 时长         [RENDER 权威]
```

---

## 字段冲突摘要

| 字段 | 标记 |
|------|------|
| storyboard.duration | MA, LO |
| shotDurationSec | MA, LO |
| editGraph | MA, LW |
| editSequence | DBP, LO |
| directorPlan | MA, DBP |
| voice timing | MA, LW |
| openCutCommands | DBP |
