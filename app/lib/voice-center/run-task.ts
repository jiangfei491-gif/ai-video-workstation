import type {
  VoiceCenterLogEntry,
  VoiceCenterProviderId,
  VoiceCenterResult,
  VoiceDirectorTask,
} from "./types";
import { logDirFor } from "@/app/lib/storage/workspace-paths";
import { getCachedResult, setCachedResult } from "./cache";
import { resolveProviderChain } from "./selector";
import { isProviderEnabled } from "./registry";
import { getVoiceCenterProvider } from "./providers";
import { postProcessVoice } from "./post-process";
import { toVoiceCenterResult } from "./providers/types";

const logs: VoiceCenterLogEntry[] = [];

/** Workspace 日志目录 */
export const voiceCenterLogRoot = logDirFor("voice-center");

export function getVoiceCenterLogs(limit = 50): VoiceCenterLogEntry[] {
  return logs.slice(-limit);
}

/**
 * 配音中心主入口：接收导演任务 → 选引擎 → 合成 → 返回统一格式。
 * 不参与任何决策，仅按任务与回退链执行。
 */
export async function runVoiceCenterTask(
  task: VoiceDirectorTask
): Promise<VoiceCenterResult> {
  if (!task.text?.trim()) {
    return {
      taskId: task.id,
      status: "failed",
      audio: { filepath: "", url: "", relativePath: "" },
      duration: 0,
      provider: task.provider ?? "f5-tts",
      voice: task.voiceId ?? "",
      sentenceTimestamp: [],
      wordTimestamp: [],
      error: "口播文本为空",
    };
  }

  const chain = resolveProviderChain(task);
  const errors: string[] = [];

  for (const providerId of chain) {
    if (!isProviderEnabled(providerId)) continue;

    const cached = getCachedResult(task, providerId);
    if (cached) {
      pushLog(task.id, providerId, cached.status, 0, cached.cost);
      return cached;
    }

    const provider = getVoiceCenterProvider(providerId);
    if (!provider) continue;

    const health = await provider.healthCheck();
    if (!health.ok) {
      errors.push(`${providerId}: ${health.message ?? "不可用"}`);
      continue;
    }

    const started = Date.now();
    try {
      let out = await provider.synthesize(task);
      out = await postProcessVoice(task, out);
      const result = toVoiceCenterResult(task, providerId, out, "success");
      setCachedResult(task, providerId, result);
      pushLog(task.id, providerId, "success", Date.now() - started, result.cost);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${providerId}: ${msg}`);
      pushLog(task.id, providerId, "failed", Date.now() - started, undefined, msg);
    }
  }

  // 最终兼容回退（链中未包含时补试）
  const fallbacks: VoiceCenterProviderId[] = [];
  if (!chain.includes("edge-tts")) fallbacks.push("edge-tts");
  if (!chain.includes("elevenlabs")) fallbacks.push("elevenlabs");

  for (const fbId of fallbacks) {
    if (!isProviderEnabled(fbId)) continue;
    const fb = getVoiceCenterProvider(fbId);
    if (!fb) continue;
    const health = await fb.healthCheck();
    if (!health.ok) {
      errors.push(`${fbId}: ${health.message ?? "不可用"}`);
      continue;
    }
    try {
      let out = await fb.synthesize(task);
      out = await postProcessVoice(task, out);
      const result = toVoiceCenterResult(task, fbId, out, "success");
      setCachedResult(task, fbId, result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${fbId}: ${msg}`);
    }
  }

  return {
    taskId: task.id,
    status: "failed",
    audio: { filepath: "", url: "", relativePath: "" },
    duration: 0,
    provider: chain[0] ?? "f5-tts",
    voice: task.voiceId ?? "",
    sentenceTimestamp: [],
    wordTimestamp: [],
    error: errors.join(" · ") || "所有配音引擎不可用",
  };
}

function pushLog(
  taskId: string,
  provider: VoiceCenterResult["provider"],
  status: VoiceCenterLogEntry["status"],
  durationMs: number,
  cost?: number,
  error?: string
) {
  const endedAt = new Date().toISOString();
  logs.push({
    taskId,
    provider,
    startedAt: new Date(Date.now() - durationMs).toISOString(),
    endedAt,
    durationMs,
    cost,
    status,
    error,
  });
  if (logs.length > 200) logs.shift();
}

/** 批量配音（按顺序队列） */
export async function runVoiceCenterBatch(
  tasks: VoiceDirectorTask[]
): Promise<VoiceCenterResult[]> {
  const results: VoiceCenterResult[] = [];
  for (const task of tasks) {
    results.push(await runVoiceCenterTask(task));
  }
  return results;
}
