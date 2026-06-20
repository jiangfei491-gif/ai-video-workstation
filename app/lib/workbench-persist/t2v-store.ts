"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  createDefaultExportMeta,
  migrateLegacyExportRecords,
  normalizeExportMeta,
  type LegacyExportRecord,
} from "@/app/lib/export/types";
import { normalizeSeedFields } from "@/app/lib/generation-params";
import type { T2VWorkbenchState } from "./types";
import {
  cacheVideoUrl,
  loadJson,
  restoreVideoUrl,
  saveJson,
} from "./storage";

const STORAGE_KEY = "workbench:t2v";

const defaultState: T2VWorkbenchState = {
  topic: "",
  shotCount: 5,
  shotDurationSec: 5,
  fps: 24,
  aspectRatio: "9:16",
  clarity: "hd",
  workspaceMode: "preview",
  characterConsistency: true,
  sceneConsistency: true,
  seedMode: "random",
  seed: null,
  voiceoverText: "",
  subtitleText: "",
  mode: "test",
  director: null,
  characterIds: [],
  canvasPositions: {},
  canvasLinks: [],
  shotFrames: {},
  shotFrameAssets: {},
  canvasRefs: [],
  canvasSections: [],
  projectStyle: "",
  activeShotIdx: 0,
  testResult: null,
  shotLock: null,
  prodResult: null,
  batchRunning: false,
  batchResults: {},
  export: createDefaultExportMeta(),
  historyEntryId: null,
  error: null,
  directorLoading: false,
  veoLoading: false,
  veoStatus: "idle",
  veoProgressStep: 1,
  veoStartedAt: null,
  veoError: null,
  veoSuccessMessage: null,
};

let state: T2VWorkbenchState = { ...defaultState };
let hydrated = false;
let inflightVeo: Promise<void> | null = null;
const listeners = new Set<() => void>();

function restoreMediaUrls(): void {
  if (state.testResult?.taskId && !state.testResult.videoUrl) {
    const cached = restoreVideoUrl(state.testResult.taskId);
    if (cached) {
      state = {
        ...state,
        testResult: { ...state.testResult, videoUrl: cached },
      };
    }
  }
  if (state.prodResult?.startsWith("blob-cache:")) {
    const cached = restoreVideoUrl(state.prodResult.replace("blob-cache:", ""));
    if (cached) state = { ...state, prodResult: cached };
  }
  // 批量结果里被剥离的 data: 视频，按 taskId 从 sessionStorage 还原
  if (state.batchResults && Object.keys(state.batchResults).length > 0) {
    const restored = { ...state.batchResults };
    let changed = false;
    for (const [idx, shot] of Object.entries(restored)) {
      if (shot.status === "success" && !shot.videoUrl && shot.taskId) {
        const cached = restoreVideoUrl(shot.taskId);
        if (cached) {
          restored[Number(idx)] = { ...shot, videoUrl: cached };
          changed = true;
        }
      }
    }
    if (changed) state = { ...state, batchResults: restored };
  }
}

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  let saved = loadJson<T2VWorkbenchState>(STORAGE_KEY);
  if (!saved) saved = loadJson<T2VWorkbenchState>("workbench-t2v-state");
  if (saved) {
    const merged = { ...defaultState, ...saved } as typeof defaultState & {
      exportRecords?: LegacyExportRecord[];
    };
    if (!merged.export) {
      merged.export = migrateLegacyExportRecords(merged.exportRecords);
    } else {
      merged.export = normalizeExportMeta(merged.export);
    }
    delete merged.exportRecords;
    state = normalizeSeedFields(merged);
  }
  restoreMediaUrls();
}

function emit(): void {
  saveJson(STORAGE_KEY, state, { stripLargeUrls: true });
  listeners.forEach((l) => l());
}

export function getT2VState(): T2VWorkbenchState {
  hydrate();
  return state;
}

export function setT2VState(patch: Partial<T2VWorkbenchState>): void {
  hydrate();
  state = normalizeSeedFields({ ...state, ...patch });
  if (patch.testResult?.videoUrl && patch.testResult.taskId) {
    cacheVideoUrl(patch.testResult.taskId, patch.testResult.videoUrl);
  }
  if (patch.prodResult && patch.prodResult.startsWith("data:")) {
    cacheVideoUrl(`prod-${state.historyEntryId ?? "current"}`, patch.prodResult);
  }
  if (patch.batchResults) {
    for (const shot of Object.values(patch.batchResults)) {
      if (shot.videoUrl?.startsWith("data:") && shot.taskId) {
        cacheVideoUrl(shot.taskId, shot.videoUrl);
      }
    }
  }
  emit();
}

export function subscribeT2V(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isT2VVeoInflight(): boolean {
  return inflightVeo !== null;
}

export function runT2VVeoTask(task: () => Promise<void>): void {
  if (inflightVeo) return;
  inflightVeo = task().finally(() => {
    inflightVeo = null;
  });
}

let inflightBatch: Promise<void> | null = null;

export function isT2VBatchInflight(): boolean {
  return inflightBatch !== null;
}

export function runT2VBatchTask(task: () => Promise<void>): void {
  if (inflightBatch) return;
  inflightBatch = task().finally(() => {
    inflightBatch = null;
  });
}

export function useT2VWorkbenchStore(): {
  state: T2VWorkbenchState;
  patch: (p: Partial<T2VWorkbenchState>) => void;
} {
  const snapshot = useSyncExternalStore(
    subscribeT2V,
    getT2VState,
    () => defaultState
  );
  const patch = useCallback((p: Partial<T2VWorkbenchState>) => {
    setT2VState(p);
  }, []);
  return { state: snapshot, patch };
}

export function restoreT2VFromHistory(snapshot: Partial<T2VWorkbenchState>): void {
  hydrate();
  const merged = { ...defaultState, ...snapshot } as typeof defaultState & {
    exportRecords?: LegacyExportRecord[];
  };
  if (!merged.export) {
    merged.export = migrateLegacyExportRecords(merged.exportRecords);
  } else {
    merged.export = normalizeExportMeta(merged.export);
  }
  delete merged.exportRecords;
  state = normalizeSeedFields(merged);
  restoreMediaUrls();
  emit();
}
