import {
  buildEditInputFromWorkbench,
  pacingFromStyle,
  syncClipAssetsFromWorkbench,
} from "@/app/lib/auto-edit";
import { generateEditPlan } from "@/app/lib/auto-edit/generate-edit-plan";
import { recordTokenCost, guessProvider } from "@/app/lib/cost-ledger/unified";
import { ensureVoiceClips } from "@/app/lib/auto-edit/audio/ensure-voice-clips";
import { attachTimelineToScriptMap, buildShotFirstScriptMap } from "@/app/lib/auto-edit/edit-graph/build-script-map";
import {
  applyDefaultTransitionsToTimeline,
  injectBgmIntoGraph,
  migrateToEditGraph,
  rebuildDerivedTracks,
  refreshEditGraphFromWorkbench,
  syncClipSpecDurations,
} from "@/app/lib/auto-edit/edit-graph";
import { createPlanVariantFromApi } from "@/app/lib/auto-edit/edit-graph/plan-variant";
import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";
import { mergeEditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";
import { recommendBgmByRules } from "@/app/lib/auto-edit/engines/music-engine/recommend";
import { generateSpokenNarrationWithAi, applySpokenNarrationsToStoryboard } from "@/app/lib/auto-edit/generate-spoken-narration";
import { editGraphToOpenCutProject } from "@/app/lib/opencut/project-bridge";
import { editGraphToTimelineSpec } from "@/app/lib/opencut/timeline-spec-bridge";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import { currentStoryboardFingerprint } from "@/app/lib/ai-director/downstream-stale";

export type AutoEditStepId =
  | "import-assets"
  | "sort-shots"
  | "set-durations"
  | "add-transitions"
  | "sync-voice"
  | "sync-subtitles"
  | "add-bgm"
  | "adjust-volume"
  | "generate-cover"
  | "build-project";

export type AutoEditStepResult = {
  id: AutoEditStepId;
  label: string;
  status: "done" | "skipped" | "failed";
  message: string;
};

export type AutoEditPipelineResult = {
  steps: AutoEditStepResult[];
  editGraph: EditGraph;
  workbenchPatch: Partial<T2VWorkbenchState>;
  timelineSpec: ReturnType<typeof editGraphToTimelineSpec>;
  openCutProject: ReturnType<typeof editGraphToOpenCutProject>;
  coverImageUrl: string | null;
};

const STEP_LABELS: Record<AutoEditStepId, string> = {
  "import-assets": "自动导入素材",
  "sort-shots": "自动排序镜头",
  "set-durations": "自动设置镜长",
  "add-transitions": "自动添加转场",
  "sync-voice": "自动同步配音",
  "sync-subtitles": "自动同步字幕",
  "add-bgm": "自动添加背景音乐",
  "adjust-volume": "自动调整音量",
  "generate-cover": "自动生成封面",
  "build-project": "生成剪辑工程",
};

function pickCoverImage(state: T2VWorkbenchState): string | null {
  const shots = state.director?.storyboard?.length ?? 0;
  for (let i = 0; i < shots; i++) {
    const batch = state.batchResults[i];
    if (batch?.firstFrameUrl) return batch.firstFrameUrl;
    const frame = state.shotFrames[i];
    if (frame) return frame;
  }
  return null;
}

/**
 * @deprecated 旧 AI 自动剪辑流水线（EditGraph + FFmpeg 为中心）。
 * 新编排请使用 `runAiCutPipeline`（app/lib/ai-cut/run-pipeline.ts）：
 * Director Plan → Clip Agent → OpenCut 命令 → OpenCut 执行引擎。
 */
export async function runAutoEditPipeline(
  state: T2VWorkbenchState,
  onStep?: (step: AutoEditStepResult) => void
): Promise<AutoEditPipelineResult> {
  const steps: AutoEditStepResult[] = [];
  const push = (id: AutoEditStepId, status: AutoEditStepResult["status"], message: string) => {
    const row: AutoEditStepResult = { id, label: STEP_LABELS[id], status, message };
    steps.push(row);
    onStep?.(row);
  };

  const input = buildEditInputFromWorkbench(state);
  if (!input) {
    push("import-assets", "failed", "请先完成 AI 编导与分镜");
    throw new Error("请先完成 AI 编导与分镜");
  }

  let workbench: T2VWorkbenchState = { ...state };
  let graph = refreshEditGraphFromWorkbench(workbench) ?? migrateToEditGraph(workbench);
  if (!graph) {
    push("import-assets", "failed", "无法初始化剪辑工程");
    throw new Error("无法初始化剪辑工程");
  }
  push("import-assets", "done", `已导入 ${graph.mediaPool.filter((m) => m.status === "ready").length} 项素材`);

  const settings = mergeEditEngineSettings(workbench.editEngineSettings);
  const pacing = pacingFromStyle(workbench);

  push("sort-shots", "done", "按导演分镜顺序排列");
  push("set-durations", "done", "准备 AI 镜长决策…");

  let plan;
  try {
    plan = await generateEditPlan(input, pacing);
    // 记入全平台成本总账（剪辑编排 GPT 决策）
    if (plan.usage) {
      recordTokenCost(
        "AI导演",
        "剪辑编排",
        guessProvider(plan.usage.model),
        plan.usage.model,
        plan.usage.inputTokens,
        plan.usage.outputTokens,
        { costUsd: plan.usage.costUsd }
      );
    }
  } catch (err) {
    push("set-durations", "failed", err instanceof Error ? err.message : String(err));
    throw err;
  }

  const sequence = syncClipAssetsFromWorkbench(plan, input);
  const variant = createPlanVariantFromApi(
    plan,
    sequence,
    input,
    `自动剪辑 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
  );

  const { timeline: plannedTracks, scriptMap: plannedScript } = rebuildDerivedTracks(
    variant.timeline,
    input
  );
  graph = {
    ...graph,
    timeline: syncClipSpecDurations(plannedTracks),
    scriptMap: plannedScript,
    plans: [...graph.plans, variant],
    activePlanId: variant.id,
    pacingProfile: variant.pacingProfile,
    updatedAt: new Date().toISOString(),
  };
  push("set-durations", "done", `${graph.timeline.video.length} 镜 · ${graph.timeline.durationSec.toFixed(0)} 秒`);

  graph = {
    ...graph,
    timeline: applyDefaultTransitionsToTimeline(graph.timeline, {
      type: settings.transition.defaultType,
      durationMs: settings.transition.defaultDurationMs,
    }),
    updatedAt: new Date().toISOString(),
  };
  push("add-transitions", "done", `默认转场 ${settings.transition.defaultType}`);

  if (workbench.director?.storyboard?.length) {
    try {
      const narrMap = await generateSpokenNarrationWithAi(input);
      const storyboard = applySpokenNarrationsToStoryboard(workbench.director.storyboard, narrMap);
      workbench = {
        ...workbench,
        director: { ...workbench.director!, storyboard },
      };
      const refreshed = refreshEditGraphFromWorkbench({ ...workbench, editGraph: graph });
      if (refreshed) graph = refreshed;
    } catch {
      /* 口播稿可选 */
    }
  }

  if (graph.timeline.voice.length > 0) {
    try {
      const ensured = await ensureVoiceClips({
        timeline: graph.timeline,
        mediaPool: graph.mediaPool,
        voiceId: workbench.editVoiceId ?? settings.voice.voiceId,
        voiceProvider: settings.voice.provider,
      });
      const scriptMap = attachTimelineToScriptMap(
        buildShotFirstScriptMap(input),
        ensured.timeline.video
      );
      graph = {
        ...graph,
        timeline: ensured.timeline,
        scriptMap,
        mediaPool: ensured.mediaPool,
        updatedAt: new Date().toISOString(),
      };
      // 单镜头配音失败不再拖垮整批：有一条成功就继续走字幕，失败镜头列在消息里供事后重试
      if (ensured.failed.length === 0) {
        push("sync-voice", "done", `配音 ${ensured.synthesized.length} 条`);
      } else if (ensured.synthesized.length > 0) {
        const shots = ensured.failed.map((f) => f.shotIndex + 1).join("、");
        push(
          "sync-voice",
          "done",
          `配音 ${ensured.synthesized.length}/${graph.timeline.voice.length} 条 · 镜 ${shots} 失败（可稍后重试）`
        );
      } else {
        const uniqueErr = [...new Set(ensured.failed.map((f) => f.error))].join(" · ");
        push("sync-voice", "failed", uniqueErr);
      }
      push(
        "sync-subtitles",
        "done",
        graph.timeline.subtitle.length > 0 ? `${graph.timeline.subtitle.length} 条字幕已打轴` : "字幕轨已就绪"
      );
    } catch (err) {
      push("sync-voice", "failed", err instanceof Error ? err.message : String(err));
      push("sync-subtitles", "skipped", "配音未完成，字幕跳过");
    }
  } else {
    push("sync-voice", "skipped", "无配音轨");
    push("sync-subtitles", "skipped", "无字幕轨");
  }

  let bgmUrl = workbench.editBgmUrl;
  if (settings.music.autoRecommend && !bgmUrl) {
    try {
      const rec = recommendBgmByRules({
        pacingProfile: graph.pacingProfile,
        durationSec: graph.timeline.durationSec,
        topic: workbench.topic,
      });
      if (rec?.url) {
        bgmUrl = rec.url;
        const injected = injectBgmIntoGraph(graph, bgmUrl, workbench.editBgmVolume);
        if (injected) graph = injected;
        push("add-bgm", "done", rec.label ?? "已推荐 BGM");
      } else {
        push("add-bgm", "skipped", "未匹配到 BGM");
      }
    } catch {
      push("add-bgm", "skipped", "BGM 推荐跳过");
    }
  } else if (bgmUrl) {
    const injected = injectBgmIntoGraph(graph, bgmUrl, workbench.editBgmVolume);
    if (injected) graph = injected;
    push("add-bgm", "done", "使用已有 BGM");
  } else {
    push("add-bgm", "skipped", "未启用 BGM");
  }

  push(
    "adjust-volume",
    "done",
    `配音 100% · BGM ${Math.round((workbench.editBgmVolume ?? 0.25) * 100)}%${settings.music.duckUnderVoice ? " · Duck 开" : ""}`
  );

  const coverImageUrl = pickCoverImage(workbench);
  push("generate-cover", coverImageUrl ? "done" : "skipped", coverImageUrl ? "封面已生成" : "暂无首帧");

  const projectName = workbench.director?.title?.trim() || "ai-video";
  const timelineSpec = editGraphToTimelineSpec(graph, projectName, {
    bgmUrl,
    bgmVolume: workbench.editBgmVolume,
    duckUnderVoice: settings.music.duckUnderVoice,
    coverImage: coverImageUrl,
  });
  const openCutProject = editGraphToOpenCutProject(graph, projectName);
  push("build-project", "done", "工程数据已写入 Timeline JSON");

  const storyboardFingerprint = currentStoryboardFingerprint(workbench);
  graph = {
    ...graph,
    storyboardFingerprint,
    updatedAt: new Date().toISOString(),
  };

  return {
    steps,
    editGraph: graph,
    workbenchPatch: {
      editGraph: graph,
      editBgmUrl: bgmUrl ?? workbench.editBgmUrl,
      editPlan: plan,
      director: workbench.director,
      editCoverImageUrl: coverImageUrl,
    },
    timelineSpec,
    openCutProject,
    coverImageUrl,
  };
}
