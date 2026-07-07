import {
  buildDirectorRequestBody,
  buildDirectorWorkbenchPatch,
  type DirectorApiResponse,
} from "./apply-director-response";
import { directorInputsFingerprint } from "@/app/lib/ai-director/run-input-fingerprint";
import { syncVideoHistoryFromWorkbench } from "@/app/lib/history/sync-video";
import { getT2VState, setT2VState } from "@/app/lib/workbench-persist/t2v-store";

export interface DirectorRunState {
  running: boolean;
  paused: boolean;
  error: string | null;
  /** 暂停时的输入指纹 — 续跑时对比以识别参数变更 */
  pausedFingerprint: string | null;
}

let state: DirectorRunState = {
  running: false,
  paused: false,
  error: null,
  pausedFingerprint: null,
};

let activeAbort: AbortController | null = null;
let pauseIntent = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<DirectorRunState>) {
  state = { ...state, ...patch };
  emit();
}

export function subscribeDirectorRun(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getDirectorRunState(): DirectorRunState {
  return state;
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

/** 暂停：可稍后继续，续跑时读取最新工作台参数 */
export function pauseDirectorRun(): void {
  if (!state.running) return;
  pauseIntent = true;
  activeAbort?.abort();
}

export function clearDirectorRunPause(): void {
  set({ paused: false, pausedFingerprint: null, error: null });
}

async function runDirectorInternal(): Promise<void> {
  if (state.running) return;
  pauseIntent = false;
  activeAbort = new AbortController();
  const fp = directorInputsFingerprint(getT2VState());
  set({ running: true, paused: false, error: null, pausedFingerprint: null });
  setT2VState({ directorLoading: true, error: null });

  try {
    const res = await fetch("/api/director", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDirectorRequestBody(getT2VState())),
      signal: activeAbort.signal,
    });
    const data = (await res.json()) as DirectorApiResponse & { error?: string };
    if (!res.ok) throw new Error(data.error ?? "编导生成失败");

    const prev = getT2VState();
    const patch = buildDirectorWorkbenchPatch(prev, data);
    setT2VState(patch);

    const historyId = await syncVideoHistoryFromWorkbench(
      { ...getT2VState(), ...patch },
      { status: "running" }
    );
    if (historyId) setT2VState({ historyEntryId: historyId });
  } catch (e) {
    if (isAbortError(e)) {
      if (pauseIntent) {
        set({
          paused: true,
          error: null,
          pausedFingerprint: fp,
        });
        return;
      }
      set({ error: "已取消" });
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    set({ error: msg });
    setT2VState({ error: msg });
  } finally {
    activeAbort = null;
    pauseIntent = false;
    set({ running: false });
    setT2VState({ directorLoading: false });
  }
}

/** 开始 / 重新开始（始终用当前工作台最新参数） */
export function startDirectorRun(): void {
  void runDirectorInternal();
}

/** 暂停后续跑 — 读取最新 getT2VState()，参数变更会自动重跑 */
export function resumeDirectorRun(): void {
  if (state.running) return;
  void runDirectorInternal();
}

export function directorParamsChangedSincePause(): boolean {
  if (!state.paused || !state.pausedFingerprint) return false;
  return directorInputsFingerprint(getT2VState()) !== state.pausedFingerprint;
}
