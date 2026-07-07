"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import ExportPanel from "@/app/components/workflows/shared/ExportPanel";
import ImageGalleryLightbox, {
  findGalleryIndex,
  shotImageGalleryItems,
  type ImageGalleryItem,
} from "@/app/components/workflows/shared/ImageGalleryLightbox";
import PipelineModeToggle from "@/app/components/workflows/shared/PipelineModeToggle";
import LoadingButton from "@/app/components/workflows/shared/LoadingButton";
import ShotLockPanel from "@/app/components/workflows/shared/ShotLockPanel";
import TaskStatusBar from "@/app/components/workflows/shared/TaskStatusBar";
import VeoProgressPanel from "@/app/components/workflows/shared/VeoProgressPanel";
import VideoPreviewPanel from "@/app/components/workflows/shared/VideoPreviewPanel";
import WorkbenchSection from "@/app/components/workflows/shared/WorkbenchSection";
import BatchGeneratePanel from "@/app/components/workflows/t2v/BatchGeneratePanel";
import ConsistencyTimelinePanel from "@/app/components/workflows/t2v/ConsistencyTimelinePanel";
import ProjectResourcesPanel from "@/app/components/workflows/t2v/ProjectResourcesPanel";
import StoryboardPanel from "@/app/components/workflows/t2v/StoryboardPanel";
import ProjectCostBreakdownPanel from "@/app/components/workflows/t2v/ProjectCostBreakdownPanel";
import type { BatchImageState } from "@/app/components/workflows/t2v/BatchImageGeneratePanel";
import VideoSettingsPanel from "@/app/components/workflows/t2v/VideoSettingsPanel";
import { resolveRequestSeed, veoAspectRatio, resolveEffectiveAspectRatio } from "@/app/lib/generation-params";
import {
  ledgerFromDirector,
  mergeShotCostIntoLedger,
} from "@/app/lib/cost-ledger/merge";
import type { ShotPipelineCostDetail } from "@/app/lib/cost-ledger/types";
import GenerationModeToggle from "@/app/components/workflows/shared/GenerationModeToggle";
import SeedModeControls from "@/app/components/workflows/shared/SeedModeControls";
import type { GenerationMode } from "@/app/lib/generation-mode";
import type { PipelineMode } from "@/app/lib/pipeline-mode";
import { PIPELINE_MODE_DESC, needsFrameGen, needsVideoGen } from "@/app/lib/pipeline-mode";
import { exportT2VProject, exportT2VShotImagesPack, exportT2VVideo } from "@/app/lib/export/executors";
import { buildShotFrameRequest } from "@/app/lib/consistency-engine/client/build-shot-frame-request";
import type { InferredVisualSettings } from "@/app/lib/director/visual-settings-shared";
import { isDefaultVisualSettings } from "@/app/lib/director/visual-settings-shared";
import { runWorkbenchExport, resetExportMeta } from "@/app/lib/export/run-export";
import { isExportSuccess } from "@/app/lib/export/types";
import { patchVideoHistoryExport } from "@/app/lib/history/video-store";
import { syncVideoHistoryFromWorkbench } from "@/app/lib/history/sync-video";
import { normalizeVeoDurationSec } from "@/app/lib/shot-control/types";
import { buildShotPlan } from "@/app/lib/shot-control/plan-from-script";
import {
  directorParamsChangedSincePause,
  getDirectorRunState,
  pauseDirectorRun,
  resumeDirectorRun,
  startDirectorRun,
  subscribeDirectorRun,
} from "@/app/lib/director/run-manager";
import { pickLongestScript } from "@/app/lib/workbench-persist/script-cache";
import {
  getT2VState,
  runT2VBatchTask,
  runT2VImageBatchTask,
  runT2VVeoTask,
  setT2VState,
  useT2VWorkbenchStore,
} from "@/app/lib/workbench-persist/t2v-store";
import type {
  BatchShotState,
  DirectorShot,
  StoryboardShot,
  VeoTestResult,
} from "@/app/lib/workbench-persist/types";

/** 批量并行时的并发上限，避免一次性打满 API 触发限流 */
const BATCH_CONCURRENCY = 3;

const VEO_MODEL = "veo-3.1-generate-preview";

function batchShotToTestResult(shot: BatchShotState | undefined): VeoTestResult | null {
  if (!shot || shot.status !== "success" || !shot.videoUrl || !shot.taskId) {
    return null;
  }
  return {
    taskId: shot.taskId,
    videoUrl: shot.videoUrl,
    seed: shot.seed ?? 0,
    firstFrameAssetId: shot.firstFrameAssetId,
    firstFrameUrl: shot.firstFrameUrl,
  };
}

function reorderArray<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function T2VWorkbench() {
  const { state, patch } = useT2VWorkbenchStore();
  const [confirmDeleteExport, setConfirmDeleteExport] = useState(false);
  // 首帧草稿（图片，走 OpenAI，与 Veo 无关）
  const [draftsByShot, setDraftsByShot] = useState<Record<number, { url: string; assetId: string }[]>>({});
  const [draftLoadingShot, setDraftLoadingShot] = useState<number | null>(null);
  const [draftErr, setDraftErr] = useState<string | null>(null);
  const [imageGallery, setImageGallery] = useState<{ items: ImageGalleryItem[]; index: number } | null>(null);
  // 图像批量状态放全局 store，切页/回来进度不丢
  const imageBatchRunning = state.imageBatchRunning ?? false;
  const imageBatchStatus = (state.imageBatchStatus ?? {}) as Record<number, BatchImageState>;
  const setImageBatchRunning = (v: boolean) => patch({ imageBatchRunning: v });
  const [visualInferring, setVisualInferring] = useState(false);
  const directorRun = useSyncExternalStore(
    subscribeDirectorRun,
    getDirectorRunState,
    getDirectorRunState
  );
  const directorPaused = directorRun.paused;
  const directorParamsChanged = directorPaused && directorParamsChangedSincePause();

  const {
    topic,
    sourceScript,
    sourceScriptLabel,
    workspaceMode,
    pipelineMode,
    mode,
    director,
    activeShotIdx,
    testResult,
    shotLock,
    prodResult,
    batchRunning,
    batchResults,
    error,
    directorLoading,
    veoLoading,
    veoStatus,
    veoProgressStep,
    veoError,
    veoSuccessMessage,
    export: exportMeta,
    historyEntryId,
  } = state;

  const isT2i = pipelineMode === "t2i";
  const isT2v = pipelineMode === "t2v";
  const isI2v = pipelineMode === "i2v";
  const showFrameGen = needsFrameGen(pipelineMode);
  const showVideoGen = needsVideoGen(pipelineMode);
  const isPreview = workspaceMode === "preview";
  const activePrompt = director?.prompts[activeShotIdx];
  const activeBatchShot = batchResults[activeShotIdx];
  const restoredBatchResult = batchShotToTestResult(activeBatchShot);
  const effectiveTestResult = testResult ?? restoredBatchResult;
  const shotId = activePrompt ? `t2v-shot-${activeShotIdx + 1}` : "";
  const veoDurationSec = normalizeVeoDurationSec(state.shotDurationSec);
  const previewUrl =
    prodResult ??
    effectiveTestResult?.videoUrl ??
    null;

  const storyboardGalleryItems = useMemo(
    () =>
      shotImageGalleryItems(
        director?.prompts.length ?? 0,
        state.shotFrames ?? {},
        (i) => `镜头 ${i + 1}`
      ),
    [director?.prompts.length, state.shotFrames]
  );

  const openStoryboardPreview = useCallback(
    (url: string) => {
      const items = storyboardGalleryItems;
      if (!items.length) return;
      setImageGallery({ items, index: findGalleryIndex(items, url) });
    },
    [storyboardGalleryItems]
  );

  const openDraftPreview = useCallback(
    (url: string, shotIdx: number) => {
      const drafts = draftsByShot[shotIdx] ?? [];
      const items = drafts.map((f, i) => ({
        url: f.url,
        title: `草稿 ${i + 1}`,
        caption: `镜头 ${shotIdx + 1}`,
      }));
      if (!items.length) return;
      setImageGallery({ items, index: findGalleryIndex(items, url) });
    },
    [draftsByShot]
  );

  useEffect(() => {
    if (director && (testResult || prodResult)) {
      syncVideoHistoryFromWorkbench(state).then((id) => {
        if (id && id !== state.historyEntryId) patch({ historyEntryId: id });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director, testResult, prodResult]);

  function applyVisualSettings(vs: InferredVisualSettings) {
    patch({
      projectBible: vs.projectBible,
      projectStyle: vs.projectStyle,
      stylePresetId: vs.stylePresetId,
      worldBible: vs.worldBible,
      cameraTemplateId: vs.cameraTemplateId,
    });
  }

  /** 导入素材脚本后，自动推断项目圣经 / 风格 / 世界观 */
  useEffect(() => {
    if (!sourceScript?.trim() || director) return;
    if (!isDefaultVisualSettings(state)) return;

    let cancelled = false;
    (async () => {
      setVisualInferring(true);
      try {
        const res = await fetch("/api/director/infer-visual-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: topic.trim() || "未命名项目",
            title: sourceScriptLabel?.trim() || topic.trim() || "素材脚本",
            script: sourceScript.trim(),
          }),
        });
        const data = await res.json();
        if (!cancelled && res.ok && data.visualSettings) {
          applyVisualSettings(data.visualSettings as InferredVisualSettings);
        }
      } catch {
        /* 推断失败不阻断工作台 */
      } finally {
        if (!cancelled) setVisualInferring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceScript, sourceScriptLabel, topic, director]);

  function resolveVeoRequest(shotIdx: number) {
    if (isT2i) {
      throw new Error("文生图模式不生成视频，请切换至文生视频或图生视频");
    }
    if (isT2v) {
      return { type: "t2v" as const, imageAssetId: undefined };
    }
    const frameAsset = getT2VState().shotFrameAssets?.[shotIdx];
    if (!frameAsset) {
      throw new Error("图生视频模式需先为当前镜头生成并选用首帧");
    }
    return { type: "i2v" as const, imageAssetId: frameAsset };
  }

  /** 文生图 + 导入长脚本：按目标时长与图片预算自动规划 */
  useEffect(() => {
    if (pipelineMode !== "t2i") return;
    if (state.imageBudget == null || state.imageBudgetMode == null) {
      const plan = buildShotPlan({
        targetDurationMinutes: state.targetDurationMinutes,
        pipelineMode: "t2i",
      });
      patch({
        imageBudget: plan.imageBudget,
        imageBudgetMode: plan.imageBudgetMode,
      });
      return;
    }
    if (!sourceScript?.trim() || director) return;
    const plan = buildShotPlan({
      scriptText: sourceScript,
      scriptTitle: sourceScriptLabel,
      pipelineMode: "t2i",
      targetDurationMinutes: state.targetDurationMinutes,
      imageBudgetMode: state.imageBudgetMode,
      imageBudget: state.imageBudgetMode === "custom" ? state.imageBudget : undefined,
    });
    if (
      state.targetDurationMinutes === plan.targetDurationMinutes &&
      state.imageBudget === plan.imageBudget &&
      state.imageBudgetMode === plan.imageBudgetMode
    ) {
      return;
    }
    patch({
      targetDurationMinutes: plan.targetDurationMinutes,
      imageBudget: plan.imageBudget,
      imageBudgetMode: plan.imageBudgetMode,
      editRenderMode: "image",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineMode, sourceScript, sourceScriptLabel, director]);

  function runDirector() {
    if (directorPaused) {
      resumeDirectorRun();
    } else {
      startDirectorRun();
    }
  }

  function runVeoTest() {
    if (!activePrompt || veoLoading) return;
    patch({
      veoLoading: true,
      veoStatus: "generating",
      veoProgressStep: 1,
      veoStartedAt: new Date().toISOString(),
      veoError: null,
      veoSuccessMessage: null,
      error: null,
    });

    runT2VVeoTask(async () => {
      const step2Timer = setTimeout(() => patch({ veoProgressStep: 2 }), 1200);
      try {
        const { type, imageAssetId } = resolveVeoRequest(activeShotIdx);
        const res = await fetch("/api/veo/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shotId,
            workspaceMode,
            mode: "test",
            type,
            imageAssetId,
            prompt: activePrompt.providerPrompt,
            model: VEO_MODEL,
            durationSec: veoDurationSec,
            aspectRatio: veoAspectRatio(state),
            seed: resolveRequestSeed(state.seedMode, state.seed),
          }),
        });
        patch({ veoProgressStep: 3 });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "视频预览失败");
        const nextTestResult: VeoTestResult = {
          taskId: data.taskId,
          videoUrl: data.videoUrl,
          seed: data.seed,
          firstFrameAssetId: data.firstFrameAssetId,
          firstFrameUrl: data.firstFrameUrl,
        };
        patch({
          testResult: nextTestResult,
          shotLock: null,
          veoStatus: "success",
          veoSuccessMessage: "视频生成完成",
          veoError: null,
        });
        patchBatchShot(activeShotIdx, {
          status: "success",
          videoUrl: data.videoUrl,
          taskId: data.taskId,
          seed: data.seed,
          firstFrameAssetId: data.firstFrameAssetId,
          firstFrameUrl: data.firstFrameUrl,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        patch({ veoStatus: "failed", veoError: msg, error: msg });
      } finally {
        clearTimeout(step2Timer);
        patch({ veoLoading: false });
      }
    });
  }

  async function lockShot() {
    if (!effectiveTestResult || !activePrompt) return;
    patch({ veoLoading: true, error: null });
    try {
      const imageAssetId = getT2VState().shotFrameAssets?.[activeShotIdx];
      const input = {
        shotId,
        prompt: activePrompt.providerPrompt,
        seed: effectiveTestResult.seed,
        firstFrameAssetId: effectiveTestResult.firstFrameAssetId ?? "preview",
        firstFrameUrl: effectiveTestResult.firstFrameUrl ?? effectiveTestResult.videoUrl ?? "",
        duration: veoDurationSec,
        aspectRatio: veoAspectRatio(state),
        model: VEO_MODEL,
        testTaskId: effectiveTestResult.taskId,
        testClipUrl: effectiveTestResult.videoUrl ?? "",
        imageAssetId,
      };
      if (isPreview) {
        patch({
          shotLock: {
            id: `preview-lock-${shotId}`,
            shotId,
            snapshot: { ...input, characterProfile: null, cameraProfile: null, lockedAt: new Date().toISOString() },
          },
          mode: "production",
        });
        return;
      }
      const res = await fetch("/api/director/shot-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "锁定失败");
      patch({ shotLock: data, mode: "production" });
    } catch (e) {
      patch({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      patch({ veoLoading: false });
    }
  }

  async function runVeoProduction() {
    if (!shotLock || !activePrompt || isPreview) return;
    patch({ veoLoading: true, veoStatus: "generating", veoProgressStep: 1, error: null });
    try {
      const res = await fetch("/api/veo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId,
          workspaceMode,
          mode: "production",
          type: isI2v ? "i2v" : "t2v",
          imageAssetId: isI2v ? shotLock.snapshot.imageAssetId : undefined,
          prompt: activePrompt.providerPrompt,
          seed: shotLock.snapshot.seed,
          model: shotLock.snapshot.model,
          durationSec: shotLock.snapshot.duration,
          aspectRatio: shotLock.snapshot.aspectRatio,
          shotLockId: shotLock.id,
        }),
      });
      patch({ veoProgressStep: 3 });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "视频正式生成失败");
      patch({
        prodResult: data.videoUrl,
        veoStatus: "success",
        veoSuccessMessage: "视频正式生成完成",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      patch({ veoStatus: "failed", veoError: msg, error: msg });
    } finally {
      patch({ veoLoading: false });
    }
  }

  async function unlockShot() {
    if (!activePrompt) return;
    if (!isPreview) {
      await fetch(`/api/director/shot-lock?shotId=${encodeURIComponent(shotId)}`, { method: "DELETE" });
    }
    patch({ shotLock: null, mode: "test", prodResult: null });
  }

  function selectShot(i: number) {
    const restoredTest = batchShotToTestResult(batchResults[i]);
    patch({
      activeShotIdx: i,
      testResult: restoredTest,
      shotLock: null,
      prodResult: null,
      mode: "test",
      veoStatus: restoredTest ? "success" : "idle",
      veoError: null,
      veoSuccessMessage: restoredTest ? "已切换到该镜头的预览结果" : null,
    });
  }

  function patchBatchShot(index: number, shot: BatchShotState) {
    setT2VState({
      batchResults: { ...getT2VState().batchResults, [index]: shot },
    });
  }

  /** 生成单个镜头（test 预览），更新 batchResults[index] */
  async function generateOneShot(index: number, prompt: string) {
    patchBatchShot(index, { status: "generating", videoUrl: null });
    try {
      const { type, imageAssetId } = resolveVeoRequest(index);
      const res = await fetch("/api/veo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId: `t2v-shot-${index + 1}`,
          workspaceMode,
          mode: "test",
          type,
          imageAssetId,
          prompt,
          model: VEO_MODEL,
          durationSec: veoDurationSec,
          aspectRatio: resolveEffectiveAspectRatio(state),
          seed: resolveRequestSeed(state.seedMode, state.seed),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失败");
      patchBatchShot(index, {
        status: "success",
        videoUrl: data.videoUrl,
        taskId: data.taskId,
        seed: data.seed,
        firstFrameAssetId: data.firstFrameAssetId,
        firstFrameUrl: data.firstFrameUrl,
      });
    } catch (e) {
      patchBatchShot(index, {
        status: "failed",
        videoUrl: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function runBatch() {
    if (!director || batchRunning) return;
    const prompts = director.prompts;
    const init: Record<number, BatchShotState> = {};
    prompts.forEach((_, i) => {
      init[i] = { status: "pending", videoUrl: null };
    });
    patch({ batchRunning: true, batchResults: init, error: null });

    runT2VBatchTask(async () => {
      let cursor = 0;
      const worker = async () => {
        while (cursor < prompts.length) {
          const i = cursor++;
          await generateOneShot(i, prompts[i].providerPrompt);
        }
      };
      const workers = Array.from(
        { length: Math.min(BATCH_CONCURRENCY, prompts.length) },
        worker
      );
      await Promise.all(workers);
      patch({ batchRunning: false });
    });
  }

  function retryShot(index: number) {
    if (!director || batchRunning) return;
    const prompt = director.prompts[index]?.providerPrompt;
    if (!prompt) return;
    runT2VBatchTask(async () => {
      patch({ batchRunning: true });
      await generateOneShot(index, prompt);
      patch({ batchRunning: false });
    });
  }

  function reindexShotRecord<T>(record: Record<number, T>, removeSet: Set<number>, oldLen: number): Record<number, T> {
    const next: Record<number, T> = {};
    let newIdx = 0;
    for (let oldIdx = 0; oldIdx < oldLen; oldIdx++) {
      if (removeSet.has(oldIdx)) continue;
      if (record[oldIdx] !== undefined) next[newIdx] = record[oldIdx];
      newIdx++;
    }
    return next;
  }

  function deleteShots(indices: number[]) {
    if (!director || indices.length === 0) return;
    const removeSet = new Set(indices);
    const oldLen = director.prompts.length;
    const prompts = director.prompts.filter((_, i) => !removeSet.has(i));
    const storyboard = director.storyboard.filter((_, i) => !removeSet.has(i));
    if (prompts.length === 0) return;

    const cur = getT2VState();
    let activeShotIdx = cur.activeShotIdx;
    if (removeSet.has(activeShotIdx)) {
      activeShotIdx = Math.min(activeShotIdx, prompts.length - 1);
    } else {
      let shift = 0;
      for (const idx of indices) {
        if (idx < activeShotIdx) shift++;
      }
      activeShotIdx -= shift;
    }

    patch({
      director: { ...director, prompts, storyboard },
      activeShotIdx,
      shotFrames: reindexShotRecord(cur.shotFrames, removeSet, oldLen),
      shotFrameAssets: reindexShotRecord(cur.shotFrameAssets, removeSet, oldLen),
      shotImageMeta: reindexShotRecord(cur.shotImageMeta, removeSet, oldLen),
      shotFavorites: reindexShotRecord(cur.shotFavorites ?? {}, removeSet, oldLen),
    });
    patch({ imageBatchStatus: reindexShotRecord(getT2VState().imageBatchStatus ?? {}, removeSet, oldLen) });
    setDraftsByShot((prev) => reindexShotRecord(prev, removeSet, oldLen));
  }

  function toggleShotFavorite(index: number) {
    const cur = getT2VState().shotFavorites ?? {};
    patch({
      shotFavorites: { ...cur, [index]: !cur[index] },
    });
  }

  function batchFavoriteShots(indices: number[]) {
    const cur = getT2VState().shotFavorites ?? {};
    const next = { ...cur };
    indices.forEach((i) => {
      next[i] = true;
    });
    patch({ shotFavorites: next });
  }

  function runBatchImagesForIndices(indices: number[], _regenerate?: boolean) {
    if (!director || imageBatchRunning || indices.length === 0) return;
    const prompts = director.prompts;
    setImageBatchRunning(true);

    runT2VImageBatchTask(async () => {
      let cursor = 0;
      const list = [...indices];
      const worker = async () => {
        while (cursor < list.length) {
          const i = list[cursor++];
          if (i >= prompts.length) continue;
          await generateOneShotImage(i, prompts[i].providerPrompt);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(BATCH_CONCURRENCY, list.length) }, worker)
      );
      setImageBatchRunning(false);
    });
  }

  function reorderShots(from: number, to: number) {
    if (!director) return;
    const prompts = reorderArray(director.prompts, from, to);
    const storyboard = reorderArray(director.storyboard, from, to);
    patch({ director: { ...director, prompts, storyboard }, activeShotIdx: to });
  }

  function updatePrompt(index: number, providerPrompt: string) {
    if (!director) return;
    patch({
      director: {
        ...director,
        prompts: director.prompts.map((p, i) => (i === index ? { ...p, providerPrompt } : p)),
      },
    });
  }

  async function fetchResourceRefs(): Promise<{
    characters: { id: string; name: string }[];
    scenes: { id: string; name: string }[];
    props: { id: string; name: string }[];
  }> {
    const [cr, sr, pr] = await Promise.all([
      fetch("/api/characters").then((r) => r.json()),
      fetch("/api/scenes").then((r) => r.json()),
      fetch("/api/props").then((r) => r.json()),
    ]);
    return {
      characters: ((cr.characters ?? []) as { id: string; name: string }[]).map((c) => ({
        id: c.id,
        name: c.name,
      })),
      scenes: ((sr.scenes ?? []) as { id: string; name: string }[]).map((s) => ({
        id: s.id,
        name: s.name,
      })),
      props: ((pr.props ?? []) as { id: string; name: string }[]).map((p) => ({
        id: p.id,
        name: p.name,
      })),
    };
  }

  async function shotFrameBody(shotIdx: number, purpose: "final" | "first-frame", count = 1) {
    const cur = getT2VState();
    const dir = cur.director;
    if (!dir) {
      return { prompt: "", count, style: cur.projectStyle, purpose, compose: false };
    }
    const refs = await fetchResourceRefs();
    return {
      ...buildShotFrameRequest(
        cur,
        dir,
        shotIdx,
        refs.characters,
        refs.scenes,
        refs.props,
        purpose
      ),
      count,
    };
  }

  function mergeShotCostPatch(costDetail?: ShotPipelineCostDetail) {
    if (!costDetail) return {};
    return {
      projectCostLedger: mergeShotCostIntoLedger(
        getT2VState().projectCostLedger,
        costDetail
      ),
    };
  }

  // 文生图 / 图生视频首帧
  async function generateShotImage(shotIdx: number) {
    const prompt = director?.prompts[shotIdx]?.providerPrompt;
    if (!prompt || draftLoadingShot !== null) return;
    onSelectShotForGenerate(shotIdx);
    setDraftLoadingShot(shotIdx);
    setDraftErr(null);
    patchImageBatchStatus(shotIdx, { status: "generating" });
    try {
      const count = isT2i ? 1 : 3;
      const body = await shotFrameBody(shotIdx, isT2i ? "final" : "first-frame", count);
      const res = await fetch("/api/director/shot-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "图片生成失败");
      const frames = (data.frames ?? []) as {
        url: string;
        assetId: string;
        model?: string;
        source?: string;
      }[];
      if (isT2i && frames[0]) {
        adoptDraft(frames[0], shotIdx);
        patchImageBatchStatus(shotIdx, { status: "success" });
      } else {
        setDraftsByShot((d) => ({ ...d, [shotIdx]: frames }));
        patchImageBatchStatus(shotIdx, { status: "success" });
      }
      if (data.timeline) {
        patch({
          shotTimeline: {
            ...getT2VState().shotTimeline,
            [shotIdx]: data.timeline,
          },
          ...mergeShotCostPatch(data.costDetail as ShotPipelineCostDetail | undefined),
        });
      } else if (data.costDetail) {
        patch(mergeShotCostPatch(data.costDetail as ShotPipelineCostDetail));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setDraftErr(msg);
      patchImageBatchStatus(shotIdx, { status: "failed", error: msg });
    } finally {
      setDraftLoadingShot(null);
    }
  }

  function onSelectShotForGenerate(shotIdx: number) {
    if (shotIdx !== activeShotIdx) selectShot(shotIdx);
  }

  function adoptDraft(
    frame: {
      url: string;
      assetId: string;
      model?: string;
      source?: string;
    },
    shotIdx: number = activeShotIdx
  ) {
    patch({
      shotFrames: { ...getT2VState().shotFrames, [shotIdx]: frame.url },
      shotFrameAssets: { ...getT2VState().shotFrameAssets, [shotIdx]: frame.assetId },
      shotImageMeta: {
        ...getT2VState().shotImageMeta,
        [shotIdx]: {
          model: frame.model ?? "gpt-image-2",
          source: frame.source ?? "gpt-image-2",
          aspectRatio: resolveEffectiveAspectRatio(state),
        },
      },
    });
  }

  function patchImageBatchStatus(index: number, status: BatchImageState) {
    patch({ imageBatchStatus: { ...(getT2VState().imageBatchStatus ?? {}), [index]: status } });
  }

  async function generateOneShotImage(index: number, _prompt: string) {
    patchImageBatchStatus(index, { status: "generating" });
    try {
      const body = await shotFrameBody(index, "final", 1);
      const res = await fetch("/api/director/shot-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失败");
      const frame = (data.frames as {
        url: string;
        assetId: string;
        model?: string;
        source?: string;
      }[] | undefined)?.[0];
      if (!frame) throw new Error("未返回图片");
      patch({
        shotFrames: { ...getT2VState().shotFrames, [index]: frame.url },
        shotFrameAssets: { ...getT2VState().shotFrameAssets, [index]: frame.assetId },
        shotImageMeta: {
          ...getT2VState().shotImageMeta,
          [index]: {
            model: frame.model ?? "gpt-image-2",
            source: frame.source ?? "gpt-image-2",
            aspectRatio: veoAspectRatio(state),
          },
        },
        ...(data.timeline
          ? {
              shotTimeline: {
                ...getT2VState().shotTimeline,
                [index]: data.timeline,
              },
            }
          : {}),
        ...mergeShotCostPatch(data.costDetail as ShotPipelineCostDetail | undefined),
      });
      patchImageBatchStatus(index, { status: "success" });
    } catch (e) {
      patchImageBatchStatus(index, {
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function runBatchImages() {
    if (!director || imageBatchRunning) return;
    const prompts = director.prompts;
    const init: Record<number, BatchImageState> = {};
    prompts.forEach((_, i) => {
      init[i] = { status: "pending" };
    });
    patch({ imageBatchStatus: init });
    setImageBatchRunning(true);

    runT2VImageBatchTask(async () => {
      let cursor = 0;
      const worker = async () => {
        while (cursor < prompts.length) {
          const i = cursor++;
          await generateOneShotImage(i, prompts[i].providerPrompt);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(BATCH_CONCURRENCY, prompts.length) }, worker)
      );
      setImageBatchRunning(false);
    });
  }

  async function handleExportImages() {
    const frames = getT2VState().shotFrames ?? {};
    if (!Object.keys(frames).length) {
      patch({
        export: {
          ...exportMeta,
          exportStatus: "failed",
          exportError: "没有可导出的分镜图片",
          lastExportType: "images",
        },
      });
      return;
    }
    try {
      const fileName = `images_${(topic || "storyboard").replace(/\s+/g, "_")}.zip`;
      const meta = await runWorkbenchExport({
        exportType: "images",
        fileName,
        getExport: () => getT2VState().export,
        patchExport: (m) => patch({ export: m }),
        execute: async (onProgress) => {
          await exportT2VShotImagesPack(getT2VState(), onProgress);
        },
      });
      await syncExportHistory(meta);
    } catch {
      /* failed state patched */
    }
  }

  async function syncExportHistory(meta: ReturnType<typeof getT2VState>["export"]) {
    if (historyEntryId) {
      patchVideoHistoryExport(historyEntryId, meta);
    } else if (director) {
      const id = await syncVideoHistoryFromWorkbench(getT2VState());
      patch({ historyEntryId: id });
    }
  }

  async function handleExportProject() {
    if (!director) {
      patch({
        export: {
          ...exportMeta,
          exportStatus: "failed",
          exportError: "请先完成编导生成",
          lastExportType: "project",
        },
      });
      return;
    }
    try {
      const meta = await runWorkbenchExport({
        exportType: "project",
        fileName: `project_${(topic || "video").replace(/\s+/g, "_")}.zip`,
        getExport: () => getT2VState().export,
        patchExport: (m) => patch({ export: m }),
        execute: async (onProgress) => {
          const name = await exportT2VProject(getT2VState(), onProgress);
          onProgress(100, "导出完成");
          void name;
        },
      });
      await syncExportHistory(meta);
    } catch {
      /* failed state patched */
    }
  }

  async function handleExportVideo() {
    if (!previewUrl) {
      patch({
        export: {
          ...exportMeta,
          exportStatus: "failed",
          exportError: "没有可导出的视频",
          lastExportType: "video",
        },
      });
      return;
    }
    try {
      const exportTopic = (director?.title ?? topic) || "video";
      const fileName = `${exportTopic.replace(/\s+/g, "_")}_video.mp4`;
      const meta = await runWorkbenchExport({
        exportType: "video",
        fileName,
        getExport: () => getT2VState().export,
        patchExport: (m) => patch({ export: m }),
        execute: async (onProgress) => {
          await exportT2VVideo(previewUrl, exportTopic, onProgress);
        },
      });
      await syncExportHistory(meta);
    } catch {
      /* failed state patched */
    }
  }

  function deleteExportRecord() {
    const cleared = resetExportMeta();
    patch({ export: cleared });
    if (historyEntryId) patchVideoHistoryExport(historyEntryId, cleared);
    setConfirmDeleteExport(false);
  }

  const lockedFrameCount = Object.keys(state.shotFrameAssets ?? {}).length;
  const shotTotal = director?.prompts.length ?? 0;

  const exportStep = {
    id: "export",
    label: "导出",
    status:
      exportMeta.exportStatus === "exporting"
        ? ("active" as const)
        : isExportSuccess(exportMeta)
          ? ("done" as const)
          : exportMeta.exportStatus === "failed"
            ? ("failed" as const)
            : ("pending" as const),
  };

  const topicStep = { id: "topic", label: "主题", status: topic.trim() ? ("done" as const) : ("pending" as const) };
  const directorStep = {
    id: "director",
    label: "编导",
    status: directorLoading ? ("active" as const) : director ? ("done" as const) : ("pending" as const),
  };
  const t2iStep = {
    id: "t2i",
    label: "文生图",
    status: !director
      ? ("pending" as const)
      : lockedFrameCount >= shotTotal && shotTotal > 0
        ? ("done" as const)
        : lockedFrameCount > 0
          ? ("active" as const)
          : ("pending" as const),
  };
  const t2vStep = {
    id: "t2v",
    label: "文生视频",
    status:
      veoStatus === "generating"
        ? ("active" as const)
        : veoStatus === "success"
          ? ("done" as const)
          : veoStatus === "failed"
            ? ("failed" as const)
            : ("pending" as const),
  };
  const i2vStep = {
    id: "i2v",
    label: "图生视频",
    status:
      veoStatus === "generating"
        ? ("active" as const)
        : veoStatus === "success"
          ? ("done" as const)
          : veoStatus === "failed"
            ? ("failed" as const)
            : ("pending" as const),
  };

  const pipelineSteps =
    pipelineMode === "t2i"
      ? [topicStep, directorStep, t2iStep, exportStep]
      : pipelineMode === "t2v"
        ? [topicStep, directorStep, t2vStep, exportStep]
        : [topicStep, directorStep, t2iStep, i2vStep, exportStep];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
        <h1 className="workbench-page-title">创作中心</h1>
        <p className="workbench-page-desc mt-1">
          {PIPELINE_MODE_DESC[pipelineMode]} · 项目设定 → 编导分镜 → 单镜生成/锁定 → 导出
        </p>
        <div className="mt-3">
          <PipelineModeToggle
            mode={pipelineMode}
            onChange={(m: PipelineMode) => patch({ pipelineMode: m })}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <TaskStatusBar steps={pipelineSteps} />

        <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.92fr)_minmax(560px,1.45fr)]">
          <div className="min-w-0">
            <WorkbenchSection title="1. 项目起步">
              {sourceScript?.trim() && (
                <div className="mb-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--bg-inset)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                  <p className="font-medium text-[var(--accent)]">已导入素材脚本</p>
                  <p className="mt-0.5 text-[var(--text-caption)]">
                    {sourceScriptLabel || "素材库脚本"} · 运行编导时将<strong>跳过 AI 写脚本</strong>，直接基于此稿生成分镜；
                    {visualInferring ? " 正在推断视觉设定…" : " 项目圣经 / 风格 / 世界观已自动推断"}
                  </p>
                </div>
              )}
              <label className="workbench-label mb-2 block">视频主题</label>
              <textarea
                className="input-field min-h-[96px] w-full rounded-lg px-3 py-2.5 text-sm leading-relaxed"
                value={topic}
                onChange={(e) => patch({ topic: e.target.value })}
                placeholder="写清楚题材、人物、情绪和目标受众；例如：一个创业者深夜用 AI 做完一支广告片"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {directorPaused && (
                  <p className="w-full text-xs text-amber-600 dark:text-amber-300">
                    编导已暂停
                    {directorParamsChanged
                      ? " · 检测到参数已变更，继续运行将使用最新设置"
                      : " · 可随时改参数后继续"}
                  </p>
                )}
                <LoadingButton
                  loading={directorLoading}
                  loadingText="编导运行中…"
                  disabled={!topic.trim() || directorLoading}
                  onClick={runDirector}
                >
                  {directorPaused
                    ? "继续运行编导"
                    : director
                      ? "重新运行编导"
                      : "运行编导"}
                </LoadingButton>
                {directorLoading && (
                  <button
                    type="button"
                    onClick={() => pauseDirectorRun()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-600 dark:text-amber-300 hover:bg-amber-500/20"
                  >
                    暂停
                  </button>
                )}
                {director && (
                  <>
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      已生成 {director.prompts.length} 个镜头
                    </span>
                    <Link
                      href="/canvas"
                      className="text-xs font-medium text-[var(--accent)] hover:underline"
                    >
                      在无限画布中继续剪辑 →
                    </Link>
                  </>
                )}
              </div>
            </WorkbenchSection>

            <WorkbenchSection title="2. 本项目资源">
              <ProjectResourcesPanel
                characterIds={state.characterIds}
                sceneIds={state.sceneIds}
                propIds={state.propIds ?? []}
                onCharacterIdsChange={(ids) => patch({ characterIds: ids })}
                onSceneIdsChange={(ids) => patch({ sceneIds: ids })}
                onPropIdsChange={(ids) => patch({ propIds: ids })}
              />
            </WorkbenchSection>

            <WorkbenchSection title="3. 项目设定">
              <VideoSettingsPanel
                state={state}
                patch={patch}
                pipelineMode={pipelineMode}
                disabled={directorLoading || veoLoading}
                visualInferring={visualInferring || directorLoading}
              />
            </WorkbenchSection>

            {director && (
              <WorkbenchSection title="剧本">
                <h3 className="workbench-heading mb-2">{director.title}</h3>
                <p className="workbench-body max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3 leading-relaxed">
                  {director.script}
                </p>
              </WorkbenchSection>
            )}
          </div>

          <div className="min-w-0 xl:sticky xl:top-0 xl:self-start">
            {!director ? (
              <section className="glass-panel rounded-xl p-5">
                <h2 className="workbench-section-title mb-3">镜头生产台</h2>
                <div className="grid gap-3 text-sm text-[var(--text-secondary)]">
                  <p>先在左侧写主题、设定镜头数量和工作模式，然后运行编导。</p>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3">
                    <p className="font-semibold text-[var(--text-primary)]">推荐顺序</p>
                    <p className="mt-1 leading-relaxed">
                      {isT2i
                        ? "主题 → 项目设定 → 导入角色 → 运行编导 → 文生图生成各镜图片 → 导出图片包"
                        : isT2v
                          ? "主题 → 项目设定 → 导入角色 → 运行编导 → 改镜头 Prompt → 生成预览 → 锁定 → 正式生成"
                          : "主题 → 项目设定 → 导入角色 → 运行编导 → 文生图锁定首帧 → 图生视频 → 导出"}
                    </p>
                  </div>
                </div>
              </section>
            ) : (
                <>
                {isT2i && director && (
                  <WorkbenchSection title="4. 一致性时间轴">
                    <ConsistencyTimelinePanel
                      activeShotIdx={activeShotIdx}
                      shotTimeline={state.shotTimeline ?? {}}
                      onSelectShot={selectShot}
                      total={director.prompts.length}
                    />
                  </WorkbenchSection>
                )}
                {director && !isT2i && (
                  <WorkbenchSection title="API 话费详情">
                    <ProjectCostBreakdownPanel ledger={state.projectCostLedger} />
                  </WorkbenchSection>
                )}
                <WorkbenchSection title={isT2i ? "5. 分镜生成" : "4. 分镜与提示词"}>
                  <StoryboardPanel
                    director={director}
                    activeShotIdx={activeShotIdx}
                    onSelectShot={selectShot}
                    onReorder={reorderShots}
                    onUpdatePrompt={updatePrompt}
                    imageMode={isT2i}
                    shotImages={state.shotFrames}
                    shotImageMeta={state.shotImageMeta}
                    shotFavorites={state.shotFavorites ?? {}}
                    shotTimeline={state.shotTimeline ?? {}}
                    defaultAspectRatio={resolveEffectiveAspectRatio(state)}
                    draftsByShot={draftsByShot}
                    imageLoadingShot={draftLoadingShot}
                    imageBatchStatus={imageBatchStatus}
                    imageErr={draftErr}
                    onGenerateImage={generateShotImage}
                    onAdoptCandidate={(idx, frame) => adoptDraft(frame, idx)}
                    onPreviewImage={openStoryboardPreview}
                    batchRunning={imageBatchRunning}
                    onRunBatch={runBatchImages}
                    onToggleFavorite={toggleShotFavorite}
                    onRunBatchSelected={runBatchImagesForIndices}
                    onDeleteShots={deleteShots}
                    onBatchFavorite={batchFavoriteShots}
                    projectCostLedger={state.projectCostLedger}
                  />
                </WorkbenchSection>

                {showVideoGen && (
                <div className="mb-4">
                  <BatchGeneratePanel
                    director={director}
                    batchRunning={batchRunning}
                    batchResults={batchResults}
                    onRunBatch={runBatch}
                    onRetryShot={retryShot}
                    onSelectShot={selectShot}
                  />
                </div>
                )}

                {!isT2i && (
                <WorkbenchSection title="5. 当前镜头生成 / 验收">
                  {showVideoGen && !isPreview && (
                    <div className="mb-4">
                      <GenerationModeToggle
                        mode={mode}
                        onChange={(m: GenerationMode) => patch({ mode: m })}
                        productionDisabled={!shotLock}
                      />
                    </div>
                  )}
                  {isI2v && (
                  <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        首帧文生图
                        {state.shotFrameAssets?.[activeShotIdx] && (
                          <span className="ml-2 text-xs font-medium text-[var(--accent)]">
                            已锁定首帧 · 可图生视频
                          </span>
                        )}
                      </p>
                      <LoadingButton
                        variant="secondary"
                        loading={draftLoadingShot === activeShotIdx}
                        loadingText="生成草稿中…约1分钟"
                        disabled={draftLoadingShot !== null}
                        onClick={() => generateShotImage(activeShotIdx)}
                      >
                        {draftsByShot[activeShotIdx]?.length ? "重新生成草稿" : "生成 3 个首帧草稿"}
                      </LoadingButton>
                    </div>
                    {draftErr && <p className="mt-2 text-xs font-medium text-[var(--danger)]">{draftErr}</p>}
                    {draftsByShot[activeShotIdx]?.length ? (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {draftsByShot[activeShotIdx].map((f, di) => {
                          const adopted = state.shotFrames?.[activeShotIdx] === f.url;
                          return (
                            <div key={di} className={`overflow-hidden rounded-lg border ${adopted ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)]"}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={f.url}
                                alt={`草稿${di + 1}`}
                                onClick={() => openDraftPreview(f.url, activeShotIdx)}
                                className="aspect-[9/16] w-full cursor-zoom-in object-cover"
                                title="点击看大图"
                              />
                              <button
                                type="button"
                                onClick={() => adoptDraft(f, activeShotIdx)}
                                className={`w-full py-1.5 text-xs font-medium ${adopted ? "bg-[var(--accent)] text-white" : "text-[var(--accent)] hover:bg-[var(--accent-soft)]"}`}
                              >
                                {adopted ? "✓ 已选用" : "用此首帧"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-[var(--text-caption)]">
                        图生视频模式需为每个镜头生成并选用首帧，再执行图生视频。
                      </p>
                    )}
                  </div>
                  )}

                  {showVideoGen && (
                  <>
                  <div className="mb-4">
                    <SeedModeControls
                      seedMode={state.seedMode}
                      seed={state.seed}
                      disabled={veoLoading}
                      onChange={(p) => patch(p)}
                    />
                  </div>
                  {mode === "test" || isPreview ? (
                    <div className="mb-4 flex flex-wrap gap-2">
                      <LoadingButton loading={veoLoading} loadingText="生成中…" disabled={veoLoading} onClick={runVeoTest}>
                        {previewUrl ? "重新生成预览" : `${veoDurationSec} 秒预览`}
                      </LoadingButton>
                      {!isPreview && (
                        <LoadingButton variant="secondary" disabled={veoLoading || !effectiveTestResult} onClick={lockShot}>
                          确认并锁定
                        </LoadingButton>
                      )}
                    </div>
                  ) : (
                    <div className="mb-4">
                      <LoadingButton loading={veoLoading} loadingText="正式生成中…" disabled={veoLoading || !shotLock} onClick={runVeoProduction}>
                        正式生成（{veoDurationSec} 秒）
                      </LoadingButton>
                    </div>
                  )}
                  <VeoProgressPanel status={veoStatus} step={veoProgressStep} error={veoError} successMessage={veoSuccessMessage} />
                  <VideoPreviewPanel status={veoStatus} videoUrl={previewUrl} error={veoError} />
                  {!isPreview && <ShotLockPanel lock={shotLock} onUnlock={unlockShot} />}
                  </>
                  )}
                </WorkbenchSection>
                )}
              </>
            )}
          </div>
        </div>

        {/* 底部横跨整宽：导出（左右两栏在此齐平收口） */}
        <div className="mt-5">
          <ExportPanel
            workbench={isT2i ? "t2i" : "t2v"}
            exportMeta={exportMeta}
            canExportProject={!!director}
            canExportMedia={isT2i ? lockedFrameCount > 0 : !!previewUrl}
            onExportProject={handleExportProject}
            onExportMedia={isT2i ? handleExportImages : handleExportVideo}
            onDeleteRecord={() => setConfirmDeleteExport(true)}
          />
        </div>

        {confirmDeleteExport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="rounded-xl bg-[var(--bg-surface)] p-6 shadow-xl">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {isExportSuccess(exportMeta)
                  ? "此项目已导出过。确认删除本地记录？"
                  : "确认删除导出记录？"}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn-secondary rounded-lg px-3 py-1.5 text-sm" onClick={() => setConfirmDeleteExport(false)}>取消</button>
                <button type="button" className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-sm text-white" onClick={deleteExportRecord}>确认删除</button>
              </div>
            </div>
          </div>
        )}

        {error && veoStatus !== "failed" && (
          <p className="mt-4 text-sm font-semibold text-[var(--danger)]">{error}</p>
        )}

        {imageGallery && (
          <ImageGalleryLightbox
            items={imageGallery.items}
            index={imageGallery.index}
            onClose={() => setImageGallery(null)}
            onIndexChange={(index) => setImageGallery((g) => (g ? { ...g, index } : null))}
          />
        )}
      </div>
    </div>
  );
}
