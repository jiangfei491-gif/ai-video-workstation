# AUTHORITY_CONFLICT_MATRIX

> 基于源码调用链与字段写入追踪。冲突等级依据：是否有多个模块写入同一生产字段、最终消费者是否读取被覆盖前的值。

| 领域 | 名义负责人 | 真实负责人 | 次级写入者 | 覆盖路径 | 最终消费者 | 冲突等级 |
|------|-----------|-----------|-----------|---------|-----------|---------|
| Director | `runDirectorPipeline` | `runDirectorPipeline`（生成）+ 两条 apply 路径（写回分歧） | `buildDirectorWorkbenchPatch`；`applyDirectorPipelineToWorkbench`；`T2VWorkbench.deleteShots/reorderShots`；`applySpokenNarrationsToStoryboard` | AI Director apply 覆盖 t2i duration；口播 API 覆盖 narration | `buildEditInputFromWorkbench`；`runBatchShotImages`；UI StoryboardPanel | **HIGH** |
| Narrative | `generateNarrativeStoryboard` → `splitNarrativeShots` | `runDirectorPipeline`（t2i） | `enrichBeatWithProcess`；`applySpokenNarrationsToStoryboard`（仅 narration） | 无独立 Narrative 持久层；beats 存 `narrativeBeats`，shots 折叠进 `storyboard` | `planNarrativeDuration`；`buildEditInputFromWorkbench` | **MEDIUM** |
| Shot | `directShotsFromUnits` / `generateStoryboard` | `runDirectorPipeline` 输出的 `director.storyboard` | `buildCompatImageTasksFromDirector`（补 shotId）；用户删镜/排序 | shotId 补全不改变叙事字段 | `buildEditInputFromWorkbench`；`EditGraph` 经 `shotIndex` | **LOW** |
| Duration | `planNarrativeDuration`（t2i 设计） | **分裂**：Planner 写 `storyboard.duration`，但剪辑链 t2i 读 `shotDurationSec` | `applyDirectorPipelineToWorkbench`；`buildEditInputFromWorkbench`；`refreshEditGraphFromWorkbench`（保留旧 clip 时长）；`ensureVoiceClips`+`alignTimelineAfterVoiceSynth`；`generateEditPlan`；UI `updateTimelineClipDuration` | apply 路径 #1；bridge t2i 分支 #2；graph refresh 保留旧值 #3；TTS 拉长不回写 render segments #4 | `buildRenderTimeline` ← `EditSequence.clip.durationSec`；`resolveAudioMixDurationSec`（混音总时长） | **CRITICAL** |
| Image Budget | `planImageBudget` | `runDirectorPipeline`（t2i） | `buildCompatImageTasksFromDirector`（无 planned tasks 时） | compat 路径替代 GPT budget plan | `runBatchShotImages`；`imageTasks` | **MEDIUM** |
| ImageTask | `planImageBudget` / `buildCompatImageTasksFromDirector` | `imageTasks` + `imageTaskMapping` in workbench | `runBatchShotImages`（写 frames）；compat 补全 | 无 imageTasks 时 compat 重建 | 批量生图；`resolveClipMedia` | **LOW** |
| Edit | `EditGraph`（注释 SSOT） | **分裂**：`runAutoEditPipeline`（GPT plan）与 `runAiCutPipeline`（DirectorPlan）并行存在 | `generateEditPlan`；`createPlanVariantFromApi`；Center workbench API；`CanvasEditShell` 手动改轨 | orchestrator 可先 auto-edit 再 ai-cut；Center 各自 refresh graph | `graphToSequence` → render | **HIGH** |
| Timeline | `EditGraph.timeline` | **分裂**：成片 render 实际吃 `EditSequence`（由 graph 派生）；OpenCut 吃 `DirectorPlan` | `editSequence` 镜像；`directorPlan`；`openCutCommands`；`AiTimelineSpec` | 多模型互转 adapter；`refreshEditGraphFromWorkbench` 保留旧 order/duration | `runRenderEngine`；`executeOpenCutCommands`（不渲染） | **CRITICAL** |
| Voice Timing | `ensureVoiceClips` | TTS 提供商返回的真实 `durationSec` | `alignTimelineAfterVoiceSynth` → `extendVideoToVoiceDuration` | 拉长 `editTimeline.video`，不回写 `EditSequence`/`RenderTimeline` | `buildAudioMixCommand`；`resolveAudioMixDurationSec` | **HIGH** |
| Subtitle Timing | `rebuildDerivedTracks` / Whisper align | `editGraph.timeline.subtitle` | `subtitle-center/workbench`；`translate-subtitles` API | Center API 写回整个 `editGraph` | `buildAssContent`（render 烧录） | **MEDIUM** |
| Music Timing | `injectBgmIntoGraph` | `editGraph.timeline.music` | `music-center/workbench`；`recommend-bgm` | BGM 轨独立于 video 规划 | `buildAudioMixCommand` | **LOW** |
| Effect Timing | `buildEffectVideoFilter` | Render 阶段 FFmpeg filter | `effect-center/workbench` | 仅 render 时应用，不改持久 timeline 语义 | `runRenderEngine` | **LOW** |
| Motion | `generateEditPlan` / DirectorPlan | **分裂**：`editGraphToTimelineSpec` 取 `cameraMotion: storyboardHint`；render 用静态图 Ken Burns | `build-ffmpeg-commands` segment 模式 | 叙事 camera 字段未进入 render motion | `buildImageSegmentCommand` | **MEDIUM** |
| Transition | `generateEditPlan` / `applyDefaultTransitionsToTimeline` | `EditGraph.timeline.transitions` | UI `updateTimelineTransition`；`effect-center` 推荐 | GPT plan 与默认转场并存于 plans[] | `buildTransitionMergeCommand` | **MEDIUM** |
| QC | `consistency-engine` / `imageTaskTimeline` | 生图 QC 写 `imageTaskTimeline`；QA Center 读 workbench | `qa-center/workbench` auto-fix | 不直接改 director.storyboard | 生图重试；UI 展示 | **LOW** |
| Render | `runRenderEngine`（FFmpeg） | `runRenderEngine` | `ensureVoiceClips`（先改 timeline 再 render）；`buildRenderPlan` 内 validate | TTS 与 video segment 时长不同步 | `finalEditVideoUrl` | **HIGH** |
| Persistence | PostgreSQL `workbench_sessions`（设计） | **分裂**：Workbench UI → PG；业务实体 → Workspace JSON；Repository PG 层 app 未用 | `readProductionJson`/`writeProductionJson` 14+ stores；`sessionStorage` 大 data URL | 双世界：PG session vs JSON files | 各模块各自读写的 store | **CRITICAL** |

## 图例

- **NONE**：单一写入者，路径清晰
- **LOW**：有次级写入但不影响主链
- **MEDIUM**：存在覆盖但主链可辨识
- **HIGH**：名义与真实负责人不一致，或覆盖影响下游
- **CRITICAL**：多权威并行，最终消费者读取的来源与规划层脱节
