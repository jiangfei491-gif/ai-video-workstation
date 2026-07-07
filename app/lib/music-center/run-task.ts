import { logDirFor } from "@/app/lib/storage/workspace-paths";
import type {
  MusicCenterLogEntry,
  MusicCenterResult,
  MusicDirectorTask,
} from "./types";
import { runDeepSeekMusicPlan, recommendMusicPlanFallback } from "./deepseek-agent";
import { buildMusicExports } from "./engines/export";
import { mergeBeatMarkers } from "./engines/rhythm";
import { buildDuckingSegments } from "./engines/ducking";
import { buildMediaPoolEntry, buildMusicTimelineClips } from "./engines/timeline";
import { findLibraryEntryByFilename, findLibraryEntryByUrl } from "./bgm-library";
import { buildOpenCutMusicPayload } from "./opencut-adapter";

const logs: MusicCenterLogEntry[] = [];

export const musicCenterLogRoot = logDirFor("music-center");

export function getMusicCenterLogs(limit = 50): MusicCenterLogEntry[] {
  return logs.slice(-limit);
}

/**
 * 音乐中心主入口：DeepSeek 推荐 → Rule Engine 时间轴 → Export → OpenCut
 */
export async function runMusicCenterTask(
  task: MusicDirectorTask
): Promise<MusicCenterResult> {
  const started = Date.now();
  const fail = (error: string): MusicCenterResult => ({
    taskId: task.id,
    status: "failed",
    music: [],
    mediaRefId: "bgm-main",
    exports: { json: "" },
    openCut: { musicTracks: [], commands: [] },
    error,
  });

  if (task.durationSec <= 0) {
    return fail("视频时长无效");
  }

  try {
    let plan;
    let cost = 0;

    if (task.bgmUrl || task.bgmFilename) {
      const entry =
        (task.bgmFilename && findLibraryEntryByFilename(task.bgmFilename)) ||
        (task.bgmUrl && findLibraryEntryByUrl(task.bgmUrl));
      if (!entry) {
        return fail("指定的 BGM 不在库中");
      }
      const { plan: aiPlan, cost: aiCost } = task.optimizeWithAi
        ? await runDeepSeekMusicPlan({ ...task, bgmFilename: entry.filename })
        : {
            plan: {
              bgmFilename: entry.filename,
              bgmUrl: entry.url,
              bgmLabel: entry.filename,
              style: task.template ?? "documentary",
              rationale: ["用户指定 BGM"],
              bpm: task.bpm,
              volumeStrategy: {
                baseVolume: task.baseVolume ?? 0.25,
                duckUnderVoice: task.duckUnderVoice !== false,
                duckAmount: task.duckAmount ?? 0.12,
                fadeInSec: task.fadeInSec ?? 1.5,
                fadeOutSec: task.fadeOutSec ?? 2,
                duckSegments: [],
              },
            },
            cost: 0,
          };
      plan = aiPlan;
      plan.bgmFilename = entry.filename;
      plan.bgmUrl = entry.url;
      plan.bgmLabel = entry.filename;
      cost += aiCost;
    } else if (task.optimizeWithAi !== false) {
      const ai = await runDeepSeekMusicPlan(task);
      plan = ai.plan;
      cost += ai.cost;
    } else {
      plan = recommendMusicPlanFallback(task);
    }

    plan.beatMarkers = mergeBeatMarkers(plan, task.durationSec);
    plan.volumeStrategy.duckSegments = buildDuckingSegments(task, plan.volumeStrategy);

    const mediaRefId = "bgm-main";
    const music = buildMusicTimelineClips(task, plan, mediaRefId);
    const exports = buildMusicExports({ clips: music, plan });
    const openCut = buildOpenCutMusicPayload({ clips: music, plan, mediaRefId });

    const result: MusicCenterResult = {
      taskId: task.id,
      status: "success",
      music,
      mediaRefId,
      plan,
      exports,
      openCut,
      cost,
    };

    pushLog(task.id, "success", Date.now() - started, plan.bgmLabel, cost);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    pushLog(task.id, "failed", Date.now() - started, undefined, undefined, msg);
    return fail(msg);
  }
}

export { buildMediaPoolEntry };

function pushLog(
  taskId: string,
  status: MusicCenterLogEntry["status"],
  durationMs: number,
  bgmLabel?: string,
  cost?: number,
  error?: string
) {
  logs.push({
    taskId,
    startedAt: new Date(Date.now() - durationMs).toISOString(),
    endedAt: new Date().toISOString(),
    durationMs,
    status,
    bgmLabel,
    cost,
    error,
  });
  if (logs.length > 200) logs.shift();
}
