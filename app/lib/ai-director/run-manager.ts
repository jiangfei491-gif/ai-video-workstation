import { consumeAiDirectorSse } from "./consume-sse";
import {
  directorInputsFingerprint,
  editSettingsFingerprint,
} from "./run-input-fingerprint";
import type {
  AiDirectorOrchestratorStep,
  AiDirectorPhase,
  AiDirectorRunOptions,
  AiDirectorRunResult,
} from "./types";
import { getT2VState, setT2VState } from "@/app/lib/workbench-persist/t2v-store";
import { appendClientWorkbenchActivity, patchClientWorkbenchActivity } from "@/app/lib/workbench-activity/client-store";

/**
 * AI 导演运行管理器（模块级单例）。
 * 运行独立于页面组件——切换/离开页面不会中断，回来还能看到进度与结果。
 */

export interface AiDirectorRunCheckpoint {
  completedPhases: AiDirectorPhase[];
  directorFingerprint: string;
  editFingerprint: string;
  options: AiDirectorRunOptions;
}

export interface AiDirectorRunState {
  running: boolean;
  paused: boolean;
  steps: AiDirectorOrchestratorStep[];
  result: AiDirectorRunResult | null;
  error: string | null;
  percent: number;
  startedAt: number | null;
  checkpoint: AiDirectorRunCheckpoint | null;
}

let state: AiDirectorRunState = {
  running: false,
  paused: false,
  steps: [],
  result: null,
  error: null,
  percent: 0,
  startedAt: null,
  checkpoint: null,
};

let activeAbort: AbortController | null = null;
let pauseIntent = false;

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
export function subscribeAiDirectorRun(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function getAiDirectorRunState(): AiDirectorRunState {
  return state;
}
function set(patch: Partial<AiDirectorRunState>) {
  state = { ...state, ...patch };
  emit();
}

function phasesFor(options: AiDirectorRunOptions): AiDirectorPhase[] {
  const phases: AiDirectorPhase[] = ["director"];
  if (options.runBatchImages !== false) phases.push("media");
  if (options.runEditGraph !== false) phases.push("edit");
  if (options.runDirectorPlan !== false) phases.push("plan");
  return phases;
}

function computePercent(steps: AiDirectorOrchestratorStep[], options: AiDirectorRunOptions): number {
  const phases = phasesFor(options);
  let progress = 0;
  for (const ph of phases) {
    const s = steps.filter((x) => x.phase === ph);
    if (s.some((x) => x.status === "done" || x.status === "skipped")) progress += 1;
    else if (s.some((x) => x.status === "running")) progress += 0.5;
  }
  return Math.max(2, Math.min(99, Math.round((progress / phases.length) * 100)));
}

function completedPhasesFromSteps(steps: AiDirectorOrchestratorStep[]): AiDirectorPhase[] {
  const phases: AiDirectorPhase[] = ["director", "media", "edit", "plan"];
  return phases.filter((ph) =>
    steps.some(
      (s) =>
        s.phase === ph &&
        (s.status === "done" || s.status === "skipped") &&
        !s.id.startsWith("media-shot-")
    )
  );
}

function buildResumeOptions(
  uiOptions: AiDirectorRunOptions,
  checkpoint: AiDirectorRunCheckpoint | null
): AiDirectorRunOptions {
  if (!checkpoint) return uiOptions;

  const wb = getT2VState();
  const directorParamsChanged =
    directorInputsFingerprint(wb) !== checkpoint.directorFingerprint;
  const editSettingsChanged =
    editSettingsFingerprint(wb) !== checkpoint.editFingerprint;

  let resumeFromPhases = [...checkpoint.completedPhases];
  if (directorParamsChanged) {
    resumeFromPhases = resumeFromPhases.filter((p) => p !== "director" && p !== "media");
  }
  if (editSettingsChanged) {
    resumeFromPhases = resumeFromPhases.filter((p) => p !== "edit" && p !== "plan");
  }

  return {
    ...uiOptions,
    resumeFromPhases,
    directorParamsChanged,
    editSettingsChanged,
  };
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

const PHASES: AiDirectorPhase[] = ["director", "media", "edit", "plan"];

/** 同 id 更新；阶段有实质进度后移除 *-start 占位，避免一直转圈 */
function upsertAiDirectorStep(
  steps: AiDirectorOrchestratorStep[],
  step: AiDirectorOrchestratorStep
): AiDirectorOrchestratorStep[] {
  const idx = steps.findIndex((s) => s.id === step.id);
  let next =
    idx >= 0 ? steps.map((s, i) => (i === idx ? step : s)) : [...steps, step];

  for (const phase of PHASES) {
    const phaseFinished =
      step.id === `${phase}-done` ||
      step.id === `${phase}-skip` ||
      step.id === `${phase}-skip-done`;
    const phaseProgress =
      step.phase === phase && !step.id.endsWith("-start") && step.id.startsWith(`${phase}-`);
    if (phaseFinished || phaseProgress) {
      next = next.filter(
        (s) => s.id !== `${phase}-start` && s.id !== `${phase}-stale`
      );
    }
  }

  return next;
}

/** 暂停：保留 checkpoint，续跑时读取最新工作台与 UI 选项 */
export function pauseAiDirectorRun(): void {
  if (!state.running) return;
  pauseIntent = true;
  activeAbort?.abort();
}

/** 放弃暂停状态 */
export function clearAiDirectorRunPause(): void {
  set({ paused: false, checkpoint: null, error: null });
}

export function aiDirectorParamsChangedSincePause(): boolean {
  const cp = state.checkpoint;
  if (!state.paused || !cp) return false;
  const wb = getT2VState();
  return (
    directorInputsFingerprint(wb) !== cp.directorFingerprint ||
    editSettingsFingerprint(wb) !== cp.editFingerprint
  );
}

async function runInternal(uiOptions: AiDirectorRunOptions, resume: boolean): Promise<void> {
  if (state.running) return;
  pauseIntent = false;
  activeAbort = new AbortController();
  const signal = activeAbort.signal;

  const options = resume
    ? buildResumeOptions(uiOptions, state.checkpoint)
    : uiOptions;

  const priorSteps = resume ? state.steps : [];
  set({
    running: true,
    paused: false,
    error: null,
    result: resume ? state.result : null,
    percent: resume ? state.percent : 2,
    startedAt: resume ? state.startedAt : Date.now(),
    checkpoint: resume ? state.checkpoint : null,
  });
  setT2VState({ directorLoading: true, error: null });

  const act = appendClientWorkbenchActivity({
    moduleId: "ai-director",
    moduleLabel: "AI 导演",
    actor: "AI 导演",
    status: "running",
    message: resume ? "继续运行 AI 导演…" : "一键运行 AI 导演…",
  });

  try {
    const res = await fetch("/api/ai-director/run?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workbench: getT2VState(), options }),
      signal,
    });
    if (!res.ok && !res.body) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "运行失败");
    }
    await consumeAiDirectorSse(res, {
      onStep: (step) => {
        const steps = upsertAiDirectorStep(getAiDirectorRunState().steps, step);
        set({ steps, percent: computePercent(steps, options) });
      },
      onComplete: (data) => {
        if (data.result.workbenchPatch) setT2VState(data.result.workbenchPatch);
        set({ result: data.result, percent: 100, checkpoint: null, paused: false });
      },
      onError: (message) => {
        throw new Error(message);
      },
    });
    patchClientWorkbenchActivity(act.id, { status: "success", message: "AI 导演运行完成" });
  } catch (e) {
    if (isAbortError(e)) {
      if (pauseIntent) {
        const wb = getT2VState();
        set({
          paused: true,
          error: null,
          checkpoint: {
            completedPhases: completedPhasesFromSteps(state.steps),
            directorFingerprint: directorInputsFingerprint(wb),
            editFingerprint: editSettingsFingerprint(wb),
            options: uiOptions,
          },
        });
        patchClientWorkbenchActivity(act.id, {
          status: "failed",
          message: "AI 导演已暂停",
        });
        return;
      }
      set({ error: "已取消" });
      patchClientWorkbenchActivity(act.id, { status: "failed", message: "AI 导演已取消" });
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    set({ error: msg, checkpoint: null, paused: false });
    setT2VState({ error: msg });
    patchClientWorkbenchActivity(act.id, { status: "failed", message: "AI 导演运行失败", detail: msg });
  } finally {
    activeAbort = null;
    pauseIntent = false;
    set({ running: false });
    setT2VState({ directorLoading: false });
  }
}

/** 全新运行 */
export async function startAiDirectorRun(options: AiDirectorRunOptions): Promise<void> {
  set({ steps: [], result: null, checkpoint: null, paused: false });
  await runInternal(options, false);
}

/** 暂停后续跑 — 始终读取最新 workbench + UI 选项 */
export async function resumeAiDirectorRun(options: AiDirectorRunOptions): Promise<void> {
  if (!state.paused || !state.checkpoint) {
    await startAiDirectorRun(options);
    return;
  }
  await runInternal(options, true);
}

/** @deprecated 使用 pauseAiDirectorRun */
export function cancelAiDirectorRun(): void {
  pauseAiDirectorRun();
}
