"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  createDefaultExportMeta,
  migrateLegacyExportRecords,
  normalizeExportMeta,
  type LegacyExportRecord,
} from "@/app/lib/export/types";
import { normalizeSeedFields, normalizeAspectClarityFields } from "@/app/lib/generation-params";
import { normalizePipelineMode } from "@/app/lib/pipeline-mode";
import { DEFAULT_PROJECT_BIBLE } from "@/app/lib/consistency-engine/types/bibles";
import {
  DEFAULT_CONSISTENCY_SETTINGS,
  DEFAULT_WORLD_BIBLE,
} from "@/app/lib/consistency-engine/types/world-style-camera";
import type { T2VWorkbenchState } from "./types";
import {
  DEFAULT_CANVAS_UI,
  type CanvasShellLayout,
  type CanvasUiState,
} from "./types";
import {
  mergeEditEngineSettings,
} from "@/app/lib/auto-edit/engines/edit-settings";
import { resolveImageBudget, normalizeImageBudgetFields } from "@/app/lib/shot-control/image-budget";
import { buildCompatImageTasksFromDirector } from "@/app/lib/image-task/client";
import {
  cacheProjectScript,
  loadCachedProjectScript,
  pickLongestScript,
} from "./script-cache";
import {
  cacheVideoUrl,
  loadJsonFromServer,
  restoreVideoUrl,
  saveJson,
} from "./storage";

const STORAGE_KEY = "workbench:t2v";

const defaultState: T2VWorkbenchState = {
  topic: "",
  imageBudget: resolveImageBudget({ targetDurationSec: 60, mode: "standard" }),
  imageBudgetMode: "standard",
  shotCount: 5,
  shotDurationSec: 5,
  fps: 24,
  aspectRatio: "9:16",
  clarity: "1080p",
  pipelineMode: "t2v",
  workspaceMode: "preview",
  characterConsistency: true,
  sceneConsistency: true,
  seedMode: "random",
  seed: null,
  mode: "test",
  director: null,
  characterIds: [],
  sceneIds: [],
  propIds: [],
  canvasPositions: {},
  canvasLinks: [],
  shotFrames: {},
  shotFrameAssets: {},
  imageTasks: [],
  imageTaskMapping: { shotToImageTaskMap: {}, imageTaskToShotIds: {} },
  imageTaskFrames: {},
  imageTaskFrameAssets: {},
  imageTaskTimeline: {},
  shotImageMeta: {},
  shotFavorites: {},
  canvasRefs: [],
  canvasSections: [],
  canvasEdges: [],
  projectStyle: "",
  projectBible: { ...DEFAULT_PROJECT_BIBLE },
  stylePresetId: "custom",
  worldBible: { ...DEFAULT_WORLD_BIBLE },
  cameraTemplateId: "medium_shot",
  shotTimeline: {},
  consistencySettings: { ...DEFAULT_CONSISTENCY_SETTINGS },
  activeShotIdx: 0,
  testResult: null,
  shotLock: null,
  prodResult: null,
  batchRunning: false,
  batchResults: {},
  imageBatchRunning: false,
  imageBatchStatus: {},
  export: createDefaultExportMeta(),
  historyEntryId: null,
  projectCostLedger: null,
  editSequence: null,
  editGraph: null,
  editPlan: null,
  directorPlan: null,
  openCutCommands: null,
  editRenderJobId: null,
  finalEditVideoUrl: null,
  editRenderMode: "mixed",
  editBgmUrl: null,
  editBgmVolume: 0.25,
  editVoiceId: "zh-CN-XiaoxiaoNeural",
  editEngineSettings: mergeEditEngineSettings(),
  editRendering: false,
  editError: null,
  editRenderProgress: null,
  editCoverImageUrl: null,
  canvasUi: { ...DEFAULT_CANVAS_UI },
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
/** hydrate 异步读 PG 期间若用户已改过状态(如跑了 AI 导演),读完不得覆盖内存(防竞态丢失新 run) */
let mutatedDuringHydrate = false;
let inflightVeo: Promise<void> | null = null;
const listeners = new Set<() => void>();

function normalizeCanvasUi(raw: Partial<CanvasUiState> | undefined): CanvasUiState {
  const shellLayout: CanvasShellLayout =
    raw?.shellLayout === "edit"
      ? "fusion"
      : raw?.shellLayout ??
        (raw?.shellTab === "edit" ? "fusion" : raw?.shellTab === "canvas" ? "canvas" : "fusion");
  const shellTab: CanvasUiState["shellTab"] = "canvas";
  return {
    ...DEFAULT_CANVAS_UI,
    ...raw,
    shellLayout,
    shellTab,
    canvasPan: { ...DEFAULT_CANVAS_UI.canvasPan, ...raw?.canvasPan },
    canvasSelectedKeys: raw?.canvasSelectedKeys ?? DEFAULT_CANVAS_UI.canvasSelectedKeys,
    editDockOpen: raw?.editDockOpen ?? DEFAULT_CANVAS_UI.editDockOpen,
    editLibraryTab: raw?.editLibraryTab ?? DEFAULT_CANVAS_UI.editLibraryTab,
    nleCanvasOverlay: raw?.nleCanvasOverlay ?? DEFAULT_CANVAS_UI.nleCanvasOverlay,
    editTimelineZoom: raw?.editTimelineZoom ?? DEFAULT_CANVAS_UI.editTimelineZoom,
  };
}

function restoreSourceScriptFromCache(merged: T2VWorkbenchState): T2VWorkbenchState {
  const cached = loadCachedProjectScript();
  if (!cached?.text) return merged;

  const sourceScript = pickLongestScript(merged.sourceScript, cached.text);
  const sourceScriptLabel = merged.sourceScriptLabel?.trim() || cached.label;
  return {
    ...merged,
    sourceScript: sourceScript || merged.sourceScript,
    sourceScriptLabel: sourceScriptLabel || merged.sourceScriptLabel,
  };
}

function syncScriptCache(patch: Partial<T2VWorkbenchState>, next: T2VWorkbenchState): void {
  const script = pickLongestScript(
    patch.sourceScript,
    patch.director?.script,
    next.sourceScript,
    next.director?.script
  );
  const label =
    patch.sourceScriptLabel ?? patch.director?.title ?? next.sourceScriptLabel ?? next.director?.title;
  if (script) cacheProjectScript(script, label);
}

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

/** 进行中标志不落库；刷新/重进页面时一律视为未在跑，避免「永远运行中」 */
function clearTransientLoadingFlags(
  merged: T2VWorkbenchState
): T2VWorkbenchState {
  return {
    ...merged,
    directorLoading: false,
    veoLoading: false,
    batchRunning: false,
    imageBatchRunning: false,
    editRendering: false,
    ...(merged.veoStatus === "generating" ? { veoStatus: "idle" as const } : {}),
  };
}

type SavedWithLegacyExport = T2VWorkbenchState & {
  exportRecords?: LegacyExportRecord[];
};

/** 旧持久化里的 exportRecords → export，并剥离遗留字段 */
function normalizeLegacyExportFields(merged: SavedWithLegacyExport): T2VWorkbenchState {
  const next = { ...merged };
  if (!next.export) {
    next.export = migrateLegacyExportRecords(next.exportRecords);
  } else {
    next.export = normalizeExportMeta(next.export);
  }
  delete next.exportRecords;
  return next;
}

function applyHydratedState(saved: T2VWorkbenchState): void {
  const merged = normalizeLegacyExportFields(
    clearTransientLoadingFlags({
      ...defaultState,
      ...saved,
    } as SavedWithLegacyExport)
  );
  merged.pipelineMode = normalizePipelineMode(merged.pipelineMode);
  merged.projectBible = { ...defaultState.projectBible, ...merged.projectBible };
  merged.worldBible = { ...defaultState.worldBible, ...merged.worldBible };
  merged.stylePresetId = merged.stylePresetId ?? "custom";
  merged.cameraTemplateId = merged.cameraTemplateId ?? "medium_shot";
  merged.shotTimeline = merged.shotTimeline ?? {};
  merged.consistencySettings = {
    ...defaultState.consistencySettings,
    ...merged.consistencySettings,
  };
  merged.shotFavorites = merged.shotFavorites ?? {};
  merged.propIds = merged.propIds ?? [];
  const hadPersistedBudget = typeof saved.imageBudget === "number";
  const budget = normalizeImageBudgetFields(merged, { hadPersistedBudget });
  merged.imageBudget = budget.imageBudget;
  merged.imageBudgetMode = budget.imageBudgetMode;
  if (
    merged.director?.storyboard?.length &&
    (!merged.imageTasks || merged.imageTasks.length === 0)
  ) {
    const compat = buildCompatImageTasksFromDirector({ director: merged.director });
    merged.imageTasks = compat.imageTasks;
    merged.imageTaskMapping = compat.mapping;
    merged.director = { ...merged.director, storyboard: compat.storyboardWithShotIds };
  } else {
    merged.imageTasks = merged.imageTasks ?? [];
    merged.imageTaskMapping =
      merged.imageTaskMapping ?? { shotToImageTaskMap: {}, imageTaskToShotIds: {} };
    merged.imageTaskFrames = merged.imageTaskFrames ?? {};
    merged.imageTaskFrameAssets = merged.imageTaskFrameAssets ?? {};
    merged.imageTaskTimeline = merged.imageTaskTimeline ?? {};
  }
  merged.editSequence = merged.editSequence ?? null;
  merged.editGraph = merged.editGraph ?? null;
  merged.editPlan = merged.editPlan ?? null;
  merged.editRenderJobId = merged.editRenderJobId ?? null;
  merged.finalEditVideoUrl = merged.finalEditVideoUrl ?? null;
  merged.editRenderMode =
    merged.editRenderMode === "image" || merged.editRenderMode === "video"
      ? merged.editRenderMode
      : "mixed";
  merged.editBgmUrl = merged.editBgmUrl ?? null;
  merged.editBgmVolume =
    typeof merged.editBgmVolume === "number" ? merged.editBgmVolume : 0.25;
  merged.editVoiceId = merged.editVoiceId ?? "zh-CN-XiaoxiaoNeural";
  merged.editEngineSettings = mergeEditEngineSettings(merged.editEngineSettings);
  merged.editRendering = merged.editRendering ?? false;
  merged.editError = merged.editError ?? null;
  merged.editRenderProgress = merged.editRenderProgress ?? null;
  merged.canvasUi = normalizeCanvasUi(merged.canvasUi);
  state = restoreSourceScriptFromCache(
    normalizeAspectClarityFields(normalizeSeedFields(merged))
  );
  restoreMediaUrls();
}

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  void loadJsonFromServer<T2VWorkbenchState>(STORAGE_KEY).then((server) => {
    // 竞态保护：若加载期间用户已改过状态(跑了导演/剪辑)，服务器旧数据不得覆盖内存
    if (mutatedDuringHydrate) return;
    if (server) {
      applyHydratedState(server);
      listeners.forEach((l) => l());
      return;
    }
    state = restoreSourceScriptFromCache(state);
    restoreMediaUrls();
  });
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
  mutatedDuringHydrate = true; // 标记：hydrate 期间已有真实修改，服务器旧数据不得回覆盖
  const canvasUi =
    patch.canvasUi ? normalizeCanvasUi({ ...state.canvasUi, ...patch.canvasUi }) : state.canvasUi;
  const merged = { ...state, ...patch, canvasUi };
  const budget = normalizeImageBudgetFields(merged, {
    hadPersistedBudget:
      typeof patch.imageBudget === "number" ||
      (typeof merged.imageBudget === "number" && "imageBudget" in patch),
  });
  state = normalizeAspectClarityFields(
    normalizeSeedFields({ ...merged, ...budget })
  );
  syncScriptCache(patch, state);
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

let inflightImageBatch: Promise<void> | null = null;

export function isT2VImageBatchInflight(): boolean {
  return inflightImageBatch !== null;
}

export function runT2VImageBatchTask(task: () => Promise<void>): void {
  if (inflightImageBatch) return;
  inflightImageBatch = task().finally(() => {
    inflightImageBatch = null;
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
  const merged = normalizeLegacyExportFields(
    clearTransientLoadingFlags({
      ...defaultState,
      ...snapshot,
    } as SavedWithLegacyExport)
  );
  merged.canvasUi = normalizeCanvasUi(merged.canvasUi);
  const budget = normalizeImageBudgetFields(merged, {
    hadPersistedBudget: typeof snapshot.imageBudget === "number",
  });
  state = restoreSourceScriptFromCache(
    normalizeAspectClarityFields(
      normalizeSeedFields({ ...merged, ...budget })
    )
  );
  restoreMediaUrls();
  emit();
}
