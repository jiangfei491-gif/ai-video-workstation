import { createRunStore } from "@/app/lib/run-store";
import { consumeQaSse } from "./consume-sse";
import type { QaAutoFixResult, QaCenterResult, QaLiveLogEntry } from "./types";
import { getT2VState, setT2VState } from "@/app/lib/workbench-persist/t2v-store";
import { appendClientWorkbenchActivity, patchClientWorkbenchActivity } from "@/app/lib/workbench-activity/client-store";

/**
 * 质检中心运行管理器（模块级单例）。
 * 质检 / 自动修复独立于页面组件——切页不中断，回来还能看到日志与结果。
 */

export type QaFixDecision = "pending" | "approved" | "declined";

export interface QaRunState {
  loading: boolean;
  result: QaCenterResult | null;
  liveLogs: QaLiveLogEntry[];
  error: string | null;
  fixLoading: boolean;
  fixResult: QaAutoFixResult | null;
  fixDecision: QaFixDecision;
}

const store = createRunStore<QaRunState>({
  loading: false,
  result: null,
  liveLogs: [],
  error: null,
  fixLoading: false,
  fixResult: null,
  fixDecision: "pending",
});

export const subscribeQaRun = store.subscribe;
export const getQaRunState = store.get;

function appendLog(entry: QaLiveLogEntry) {
  store.set({ liveLogs: [...store.get().liveLogs, entry] });
}

export interface QaRunOptions {
  optimizeWithAi: boolean;
  scoreThreshold: number;
  probeExportedVideo: boolean;
}

export async function startQa(opts: QaRunOptions): Promise<void> {
  if (store.get().loading) return;
  store.set({ loading: true, error: null, result: null, fixResult: null, fixDecision: "pending", liveLogs: [] });
  const act = appendClientWorkbenchActivity({
    moduleId: "qa-center",
    moduleLabel: "质检中心",
    actor: "质检",
    status: "running",
    message: "质检运行中…",
  });
  try {
    const res = await fetch("/api/qa-center/workbench?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workbench: getT2VState(),
        optimizeWithAi: opts.optimizeWithAi,
        scoreThreshold: opts.scoreThreshold,
        probeExportedVideo: opts.probeExportedVideo,
      }),
    });
    if (!res.ok && !res.body) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "质检失败");
    }
    await consumeQaSse(res, {
      onLog: appendLog,
      onComplete: (data) => {
        if (data.result && "score" in data.result) store.set({ result: data.result as QaCenterResult });
      },
      onError: (message) => {
        throw new Error(message);
      },
    });
    patchClientWorkbenchActivity(act.id, { status: "success", message: "质检完成" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    store.set({ error: msg });
    patchClientWorkbenchActivity(act.id, { status: "failed", message: "质检失败", detail: msg });
  } finally {
    store.set({ loading: false });
  }
}

export async function startAutoFix(approved: boolean): Promise<void> {
  const result = store.get().result;
  if (!result?.retry.retryTargets.length) return;
  if (!approved) {
    store.set({ fixDecision: "declined", fixResult: { taskId: result.taskId, status: "declined", steps: [] } });
    return;
  }
  if (store.get().fixLoading) return;
  store.set({ fixDecision: "approved", fixLoading: true, error: null, fixResult: null });
  const act = appendClientWorkbenchActivity({
    moduleId: "qa-center",
    moduleLabel: "质检中心",
    actor: "自动修复",
    status: "running",
    message: "自动定点修复中…",
  });
  appendLog({
    taskId: result.taskId,
    at: new Date().toISOString(),
    stage: "auto-fix",
    level: "info",
    message: "您已同意自动定点修复，开始执行…",
  });
  try {
    const res = await fetch("/api/qa-center/auto-fix?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workbench: getT2VState(),
        retryTargets: result.retry.retryTargets,
        approved: true,
        taskId: result.taskId,
      }),
    });
    if (!res.ok && !res.body) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "自动修复失败");
    }
    await consumeQaSse(res, {
      onLog: appendLog,
      onComplete: (data) => {
        const fix = data.result as QaAutoFixResult | undefined;
        if (fix && "steps" in fix) store.set({ fixResult: fix });
        if (data.editGraph) setT2VState({ editGraph: data.editGraph });
      },
      onError: (message) => {
        throw new Error(message);
      },
    });
    patchClientWorkbenchActivity(act.id, { status: "success", message: "自动修复完成" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    store.set({ error: msg });
    patchClientWorkbenchActivity(act.id, { status: "failed", message: "自动修复失败", detail: msg });
  } finally {
    store.set({ fixLoading: false });
  }
}
