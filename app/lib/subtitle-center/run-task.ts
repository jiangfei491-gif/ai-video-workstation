import { logDirFor } from "@/app/lib/storage/workspace-paths";
import type {
  SubtitleCenterLogEntry,
  SubtitleCenterResult,
  SubtitleDirectorTask,
} from "./types";
import { buildSubtitleClipsFromTask } from "./builder";
import { runDeepSeekSubtitlePlan } from "./deepseek-agent";
import { applyLayoutToClips } from "./engines/layout-engine";
import { autoFixSubtitleClips, runSubtitleQa } from "./engines/qa";
import { buildSubtitleExports } from "./engines/export";
import { planClipsToTimelineClips } from "./engines/timeline";
import { buildOpenCutSubtitlePayload } from "./opencut-adapter";
import { getCachedSubtitleResult, setCachedSubtitleResult } from "./cache";

const logs: SubtitleCenterLogEntry[] = [];

export const subtitleCenterLogRoot = logDirFor("subtitle-center");

export function getSubtitleCenterLogs(limit = 50): SubtitleCenterLogEntry[] {
  return logs.slice(-limit);
}

/**
 * 字幕中心主入口：Builder →（可选 DeepSeek 优化）→ Layout → QA → Export → OpenCut
 * 打轴（Whisper）与多语言翻译（GPT-4.1）由 AI 导演编排，本模块按任务执行。
 */
export async function runSubtitleCenterTask(
  task: SubtitleDirectorTask
): Promise<SubtitleCenterResult> {
  const started = Date.now();
  const fail = (error: string): SubtitleCenterResult => ({
    taskId: task.id,
    status: "failed",
    subtitle: [],
    exports: { srt: "", ass: "", webvtt: "", json: "" },
    openCut: { subtitleTracks: [], commands: [] },
    language: task.language ?? "zh",
    style: task.styleTemplate ?? "default",
    animation: task.animation ?? "fade",
    qa: [],
    error,
  });

  const cached = getCachedSubtitleResult(task);
  if (cached) {
    pushLog(task.id, "cached", Date.now() - started, cached.subtitle.length, cached.cost);
    return cached;
  }

  try {
    let planClips = buildSubtitleClipsFromTask(task);
    if (planClips.length === 0) {
      return fail("无字幕输入：请提供 sentenceTimestamp、wordTimestamp 或 script");
    }

    planClips = autoFixSubtitleClips(planClips);
    planClips = applyLayoutToClips(planClips, {
      maxCharsPerLine: task.maxCharsPerLine,
      maxLines: task.maxLines,
    });

    let plan;
    let cost = 0;
    if (task.optimizeWithAi) {
      const ai = await runDeepSeekSubtitlePlan(planClips, task);
      plan = ai.plan;
      planClips = ai.plan.clips;
      cost += ai.cost;
    }

    const qa = runSubtitleQa(planClips);
    const style = plan?.styleRecommendation ?? task.styleTemplate ?? "default";
    const animation = plan?.animationRecommendation ?? task.animation ?? "fade";

    const timelineClips = planClipsToTimelineClips(planClips);
    const exports = buildSubtitleExports({
      clips: timelineClips,
      style,
      animation,
      playRes: task.playRes,
      engineOptions: {
        ...task.engineOptions,
        highlightKeywords: task.highlightKeywords ?? task.engineOptions?.highlightKeywords,
      },
    });

    const openCut = buildOpenCutSubtitlePayload({
      clips: timelineClips,
      style,
      animation,
    });

    const result: SubtitleCenterResult = {
      taskId: task.id,
      status: "success",
      subtitle: timelineClips,
      exports,
      openCut,
      language: task.language ?? "zh",
      style,
      animation,
      plan,
      qa,
      cost,
    };

    setCachedSubtitleResult(task, result);
    pushLog(task.id, "success", Date.now() - started, timelineClips.length, cost);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    pushLog(task.id, "failed", Date.now() - started, undefined, undefined, msg);
    return fail(msg);
  }
}

function pushLog(
  taskId: string,
  status: SubtitleCenterLogEntry["status"],
  durationMs: number,
  clipCount?: number,
  cost?: number,
  error?: string
) {
  const endedAt = new Date().toISOString();
  logs.push({
    taskId,
    startedAt: new Date(Date.now() - durationMs).toISOString(),
    endedAt,
    durationMs,
    status,
    clipCount,
    cost,
    error,
  });
  if (logs.length > 200) logs.shift();
}
