import { logDirFor } from "@/app/lib/storage/workspace-paths";
import type {
  EffectCenterLogEntry,
  EffectCenterResult,
  EffectDirectorTask,
} from "./types";
import { runDeepSeekEffectPlan, recommendEffectPlanFallback } from "./deepseek-agent";
import { buildEffectExports } from "./engines/export";
import { applyEffectPlanToTimeline } from "./engines/timeline";
import { buildOpenCutEffectPayload } from "./opencut-adapter";

const logs: EffectCenterLogEntry[] = [];

export const effectCenterLogRoot = logDirFor("effect-center");

export function getEffectCenterLogs(limit = 50): EffectCenterLogEntry[] {
  return logs.slice(-limit);
}

/**
 * 特效中心主入口：DeepSeek 分析 → Rule Engine 时间轴 → Export → OpenCut
 */
export async function runEffectCenterTask(
  task: EffectDirectorTask,
  existingVideo: import("@/app/lib/auto-edit/edit-graph/types").TimelineClip[]
): Promise<EffectCenterResult> {
  const started = Date.now();
  const fail = (error: string): EffectCenterResult => ({
    taskId: task.id,
    status: "failed",
    transitions: [],
    video: existingVideo,
    exports: { json: "" },
    openCut: { transitions: [], effectHints: [], commands: [] },
    error,
  });

  if (task.videoClips.length === 0) {
    return fail("视频轨为空，请先生成分镜与时间线");
  }

  try {
    let plan;
    let cost = 0;

    if (task.optimizeWithAi !== false) {
      const ai = await runDeepSeekEffectPlan(task);
      plan = ai.plan;
      cost += ai.cost;
    } else {
      plan = recommendEffectPlanFallback(task);
    }

    const { video, transitions } = applyEffectPlanToTimeline(existingVideo, plan);
    const exports = buildEffectExports({ video, transitions, plan });
    const openCut = buildOpenCutEffectPayload({
      transitions,
      clipEffects: plan.clipEffects,
    });

    const result: EffectCenterResult = {
      taskId: task.id,
      status: "success",
      transitions,
      video,
      plan,
      exports,
      openCut,
      cost,
    };

    pushLog(
      task.id,
      "success",
      Date.now() - started,
      transitions.length,
      plan.clipEffects.length,
      cost
    );
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    pushLog(task.id, "failed", Date.now() - started, undefined, undefined, undefined, msg);
    return fail(msg);
  }
}

function pushLog(
  taskId: string,
  status: EffectCenterLogEntry["status"],
  durationMs: number,
  transitionCount?: number,
  effectCount?: number,
  cost?: number,
  error?: string
) {
  logs.push({
    taskId,
    startedAt: new Date(Date.now() - durationMs).toISOString(),
    endedAt: new Date().toISOString(),
    durationMs,
    status,
    transitionCount,
    effectCount,
    cost,
    error,
  });
  if (logs.length > 200) logs.shift();
}
