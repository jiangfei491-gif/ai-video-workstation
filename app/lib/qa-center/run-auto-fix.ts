import { buildEditInputFromWorkbench, graphToSequence } from "@/app/lib/auto-edit";
import { ensureVoiceClips } from "@/app/lib/auto-edit/audio/ensure-voice-clips";
import { alignSubtitlesWithWhisper } from "@/app/lib/auto-edit/audio/transcribe-align";
import { rebuildDerivedTracks } from "@/app/lib/auto-edit/edit-graph";
import { attachTimelineToScriptMap, buildShotFirstScriptMap } from "@/app/lib/auto-edit/edit-graph/build-script-map";
import { refreshEditGraphFromWorkbench } from "@/app/lib/auto-edit/edit-graph/refresh-graph";
import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";
import { runEffectCenterTask } from "@/app/lib/effect-center/run-task";
import type { EffectDirectorTask } from "@/app/lib/effect-center/types";
import { applyBeatSyncIfEnabled } from "@/app/lib/music-center/engines/rhythm";
import { buildMediaPoolEntry, runMusicCenterTask } from "@/app/lib/music-center/run-task";
import type { MusicDirectorTask } from "@/app/lib/music-center/types";
import { runSubtitleCenterTask } from "@/app/lib/subtitle-center";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import { appendQaLiveLog } from "./live-log";
import type { QaAutoFixResult, QaAutoFixStep, QaLiveLogEntry, QaRetryTarget } from "./types";
import type { QaProgressCallback } from "./run-task";

const FIX_ORDER: QaRetryTarget["module"][] = [
  "voice-center",
  "subtitle-center",
  "music-center",
  "effect-center",
];

function sortTargets(targets: QaRetryTarget[]): QaRetryTarget[] {
  const rank = (m: QaRetryTarget["module"]) => {
    const i = FIX_ORDER.indexOf(m);
    return i === -1 ? 99 : i;
  };
  return [...targets].sort((a, b) => rank(a.module) - rank(b.module));
}

function dedupeTargets(targets: QaRetryTarget[]): QaRetryTarget[] {
  const seen = new Set<string>();
  const out: QaRetryTarget[] = [];
  for (const t of sortTargets(targets)) {
    const key = t.module;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export async function runQaAutoFix(params: {
  workbench: T2VWorkbenchState;
  retryTargets: QaRetryTarget[];
  taskId?: string;
  onLiveLog?: QaProgressCallback;
}): Promise<QaAutoFixResult & { editSequence?: ReturnType<typeof graphToSequence> }> {
  const taskId = params.taskId ?? `autofix-${Date.now()}`;
  const steps: QaAutoFixStep[] = [];
  const emit = (stage: string, level: QaLiveLogEntry["level"], message: string, detail?: string) => {
    const entry = appendQaLiveLog({ taskId, stage, level, message, detail });
    params.onLiveLog?.(entry);
  };

  let graph = refreshEditGraphFromWorkbench(params.workbench);
  if (!graph?.timeline) {
    return {
      taskId,
      status: "failed",
      steps,
      error: "请先生成剪辑时间线",
    };
  }

  const targets = dedupeTargets(params.retryTargets);
  if (targets.length === 0) {
    return {
      taskId,
      status: "failed",
      steps,
      error: "无可执行的回流建议",
    };
  }

  emit("auto-fix", "info", `开始定点自动修复 · ${targets.length} 个环节待处理`);

  for (const target of targets) {
    if (!target.autoFixable) {
      const step: QaAutoFixStep = {
        target,
        status: "skipped",
        message: "该环节需 AI 导演 Patch Plan 或人工处理，已跳过",
      };
      steps.push(step);
      emit("auto-fix", "warn", `跳过 ${target.label}`, step.message);
      continue;
    }

    emit("auto-fix", "info", `正在修复：${target.label}`, target.action);

    try {
      if (target.module === "voice-center") {
        graph = await fixVoice(params.workbench, graph);
      } else if (target.module === "subtitle-center") {
        graph = await fixSubtitles(params.workbench, graph);
      } else if (target.module === "music-center") {
        graph = await fixMusic(params.workbench, graph);
      } else if (target.module === "effect-center") {
        graph = await fixEffects(params.workbench, graph);
      } else {
        steps.push({
          target,
          status: "skipped",
          message: "暂不支持该模块的自动修复",
        });
        emit("auto-fix", "warn", `跳过 ${target.label}`, "暂不支持自动修复");
        continue;
      }

      steps.push({ target, status: "success", message: "已完成" });
      emit("auto-fix", "ok", `${target.label} 修复完成`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      steps.push({ target, status: "failed", message: msg });
      emit("auto-fix", "error", `${target.label} 修复失败`, msg);
    }
  }

  const successCount = steps.filter((s) => s.status === "success").length;
  const failedCount = steps.filter((s) => s.status === "failed").length;
  const status =
    failedCount > 0 && successCount === 0
      ? "failed"
      : failedCount > 0 || steps.some((s) => s.status === "skipped")
        ? "partial"
        : "success";

  emit(
    "auto-fix",
    status === "failed" ? "error" : status === "partial" ? "warn" : "ok",
    `定点修复结束 · 成功 ${successCount} · 失败 ${failedCount}`
  );

  return {
    taskId,
    status,
    steps,
    editGraph: graph,
    editSequence: graphToSequence(graph),
  };
}

async function fixVoice(workbench: T2VWorkbenchState, graph: EditGraph): Promise<EditGraph> {
  const input = buildEditInputFromWorkbench(workbench);
  if (!input) throw new Error("请先运行编导生成分镜");
  if (graph.timeline.voice.length === 0) throw new Error("配音轨为空");

  const ensured = await ensureVoiceClips({
    timeline: graph.timeline,
    mediaPool: graph.mediaPool,
    voiceId: workbench.editVoiceId ?? workbench.editEngineSettings?.voice.voiceId,
  });

  const scriptMap = attachTimelineToScriptMap(
    buildShotFirstScriptMap(input),
    ensured.timeline.video
  );

  return {
    ...graph,
    timeline: ensured.timeline,
    scriptMap,
    mediaPool: ensured.mediaPool,
    updatedAt: new Date().toISOString(),
  };
}

async function fixSubtitles(workbench: T2VWorkbenchState, graph: EditGraph): Promise<EditGraph> {
  const input = buildEditInputFromWorkbench(workbench);
  if (!input) throw new Error("请先运行编导生成分镜");

  const { timeline } = rebuildDerivedTracks(graph.timeline, input);
  let next = { ...graph, timeline };

  if (next.timeline.voice.length > 0) {
    const aligned = await alignSubtitlesWithWhisper(
      next.timeline,
      next.mediaPool,
      () => undefined
    );
    next = { ...next, timeline: aligned };
  }

  if (next.timeline.subtitle.length === 0) {
    throw new Error("字幕轨为空，请先完成配音");
  }

  const engineSettings = workbench.editEngineSettings?.subtitle;
  const task = {
    id: `autofix-sub-${Date.now()}`,
    script: next.timeline.subtitle.map((c) => c.subtitle?.text ?? "").join("\n"),
    language: engineSettings?.primaryLang ?? "zh",
    styleTemplate: "tiktok" as const,
    animation: "fade" as const,
    optimizeWithAi: true,
    sentenceTimestamp: next.timeline.subtitle.map((c) => ({
      text: c.subtitle?.text ?? "",
      startSec: c.startSec,
      endSec: c.startSec + c.durationSec,
    })),
    maxCharsPerLine: engineSettings?.maxCharsPerLine,
    maxLines: engineSettings?.maxLines,
    highlightKeywords: engineSettings?.highlightKeywords,
    playRes: { w: 1080, h: workbench.aspectRatio === "16:9" ? 608 : 1920 },
  };

  const result = await runSubtitleCenterTask(task);
  if (result.status === "failed") throw new Error(result.error ?? "字幕修复失败");

  return {
    ...next,
    timeline: { ...next.timeline, subtitle: result.subtitle },
    updatedAt: new Date().toISOString(),
  };
}

async function fixMusic(workbench: T2VWorkbenchState, graph: EditGraph): Promise<EditGraph> {
  const input = buildEditInputFromWorkbench(workbench);
  const task: MusicDirectorTask = {
    id: `autofix-music-${Date.now()}`,
    durationSec: graph.timeline.durationSec,
    pacingProfile: graph.pacingProfile,
    topic: input?.topic ?? workbench.topic,
    script: graph.timeline.subtitle.map((c) => c.subtitle?.text ?? "").join("\n"),
    optimizeWithAi: true,
    voiceClips: graph.timeline.voice.map((c) => ({
      startSec: c.startSec,
      durationSec: c.durationSec,
    })),
    videoClips: graph.timeline.video.map((c) => ({
      id: c.id,
      startSec: c.startSec,
      durationSec: c.durationSec,
    })),
  };

  const result = await runMusicCenterTask(task);
  if (result.status === "failed" || !result.plan) {
    throw new Error(result.error ?? "音乐修复失败");
  }

  const mediaEntry = buildMediaPoolEntry(result.plan, result.mediaRefId);
  const pool = graph.mediaPool.filter((p) => p.id !== result.mediaRefId);
  pool.push(mediaEntry);

  let timeline = { ...graph.timeline, music: result.music };
  if (result.plan.bpm) {
    timeline = applyBeatSyncIfEnabled(timeline, result.plan.bpm, true);
  }

  return {
    ...graph,
    mediaPool: pool,
    timeline,
    updatedAt: new Date().toISOString(),
  };
}

async function fixEffects(workbench: T2VWorkbenchState, graph: EditGraph): Promise<EditGraph> {
  if (graph.timeline.video.length === 0) throw new Error("视频时间线为空");

  const input = buildEditInputFromWorkbench(workbench);
  const task: EffectDirectorTask = {
    id: `autofix-effect-${Date.now()}`,
    durationSec: graph.timeline.durationSec,
    pacingProfile: graph.pacingProfile,
    topic: input?.topic ?? workbench.topic,
    script: graph.timeline.subtitle.map((c) => c.subtitle?.text ?? "").join("\n"),
    optimizeWithAi: true,
    videoClips: graph.timeline.video.map((c) => ({
      id: c.id,
      label: c.label,
      startSec: c.startSec,
      durationSec: c.durationSec,
      shotIndex: c.video?.shotIndex,
    })),
    subtitleHints: graph.timeline.subtitle.map((c) => ({
      text: c.subtitle?.text ?? "",
      startSec: c.startSec,
      endSec: c.startSec + c.durationSec,
    })),
    voiceHints: graph.timeline.voice.map((c) => ({
      startSec: c.startSec,
      endSec: c.startSec + c.durationSec,
    })),
  };

  const result = await runEffectCenterTask(task, graph.timeline.video);
  if (result.status === "failed") throw new Error(result.error ?? "特效修复失败");

  return {
    ...graph,
    timeline: {
      ...graph.timeline,
      video: result.video,
      transitions: result.transitions,
    },
    updatedAt: new Date().toISOString(),
  };
}
