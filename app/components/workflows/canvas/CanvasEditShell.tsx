"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiFilm, FiGrid } from "react-icons/fi";
import { getT2VState, useT2VWorkbenchStore } from "@/app/lib/workbench-persist/t2v-store";
import {
  refreshEditSequenceFromWorkbench,
  refreshEditGraphFromWorkbench,
  editGraphAssetsDiffer,
  derivedTracksDiffer,
  graphToSequence,
  rebuildDerivedTracks,
  migrateToEditGraph,
  syncClipSpecDurations,
  injectBgmIntoGraph,
  reorderTimelineVideo,
  updateTimelineClipDuration,
  applyDefaultTransitionsToTimeline,
  updateTimelineTransition,
} from "@/app/lib/auto-edit";
import { applyBeatSyncToTimeline } from "@/app/lib/auto-edit/engines/story-graph/beat-sync";
import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";
import type { EditRenderJob } from "@/app/lib/auto-edit/types";
import type { EditRenderMode } from "@/app/lib/auto-edit/types";
import type { TransitionType } from "@/app/lib/auto-edit/types";
import type { CanvasShellLayout, CanvasUiState } from "@/app/lib/workbench-persist/types";
import { buildEditInputFromWorkbench } from "@/app/lib/auto-edit/workbench-bridge";
import { isEditGraphStale } from "@/app/lib/ai-director/downstream-stale";
import { mergeEditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";
import type { EditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";
import type { MediaPoolItem, TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";
import ProjectCanvas from "@/app/components/workflows/canvas/ProjectCanvas";
import MiniTimelineBar from "@/app/components/workflows/canvas/MiniTimelineBar";
import EditCenterShell from "@/app/components/workflows/canvas/edit-center/EditCenterShell";
import { createPlanVariantFromApi } from "@/app/lib/auto-edit/edit-graph/plan-variant";
import FusionShell from "@/app/components/workflows/canvas/edit-center/FusionShell";

type Tab = CanvasShellLayout;

export default function CanvasEditShell({ advancedOnly = false }: { advancedOnly?: boolean }) {
  const { state, patch } = useT2VWorkbenchStore();
  const rawLayout = state.canvasUi.shellLayout ?? "fusion";
  /** 已移除独立「剪辑」视图，旧状态回落到融合 */
  const layout: CanvasShellLayout =
    rawLayout === "edit" ? "fusion" : rawLayout;
  const patchCanvasUi = useCallback(
    (partial: Partial<CanvasUiState>) => {
      const cur = getT2VState();
      const next = { ...cur.canvasUi, ...partial };
      if (partial.shellLayout) {
        next.shellTab = "canvas";
        if (partial.shellLayout === "edit") {
          next.shellLayout = "fusion";
        }
      }
      patch({ canvasUi: next });
    },
    [patch]
  );
  const setLayout = useCallback(
    (next: Tab) => {
      const normalized: Tab = next === "edit" ? "fusion" : next;
      patchCanvasUi({
        shellLayout: normalized,
        shellTab: "canvas",
      });
    },
    [patchCanvasUi]
  );
  const renderMode = state.editRenderMode;
  const setRenderMode = useCallback(
    (mode: EditRenderMode) => patch({ editRenderMode: mode }),
    [patch]
  );
  const [planLoading, setPlanLoading] = useState(false);
  const [alignLoading, setAlignLoading] = useState(false);
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [bgmRecommendLoading, setBgmRecommendLoading] = useState(false);
  const [transitionApplyLoading, setTransitionApplyLoading] = useState(false);
  const [beatApplyLoading, setBeatApplyLoading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [focusShotIndex, setFocusShotIndex] = useState<number | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [renderProgress, setRenderProgress] = useState({ pct: 0, message: "" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recoveredJobRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const applyRenderJobResult = useCallback(
    (job: EditRenderJob) => {
      patch({
        finalEditVideoUrl: job.outputUrl ?? null,
        editRendering: false,
        editError: job.outputUrl ? null : "渲染完成但未生成可访问的视频地址",
      });
      setRenderProgress({ pct: job.progress, message: job.message });
    },
    [patch]
  );

  /** 轮询渲染任务进度（保留供单页内即时反馈；全局 Tracker 为主） */
  const waitForRenderJob = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    return new Promise<EditRenderJob>((resolve, reject) => {
      const poll = async () => {
        try {
          const res = await fetch(`/api/auto-edit/jobs/${jobId}`);
          const data = (await res.json()) as { job?: EditRenderJob; error?: string };
          if (!res.ok || !data.job) {
            throw new Error(data.error ?? "无法获取渲染进度");
          }
          const job = data.job;
          setRenderProgress({ pct: job.progress, message: job.message });

          if (job.status === "success") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            resolve(job);
          } else if (job.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            reject(new Error(job.error ?? "渲染失败"));
          }
        } catch (err) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          reject(err);
        }
      };

      void poll();
      pollRef.current = setInterval(poll, 500);
    });
  }, []);

  useEffect(() => {
    if (recoveredJobRef.current) return;
    recoveredJobRef.current = true;

    const cur = getT2VState();
    const jobId = cur.editRenderJobId;
    if (!jobId) return;

    if (cur.finalEditVideoUrl && !cur.editRendering) return;

    if (cur.editRendering) {
      // 全局 EditRenderJobTracker 负责轮询
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`/api/auto-edit/jobs/${jobId}`);
        const data = (await res.json()) as { job?: EditRenderJob };
        if (data.job?.status === "success" && data.job.outputUrl) {
          applyRenderJobResult(data.job);
        } else if (data.job?.status === "failed") {
          patch({
            editError: data.job.error ?? "渲染失败",
            editRendering: false,
          });
        }
      } catch {
        /* ignore recovery errors */
      }
    })();
  }, [waitForRenderJob, applyRenderJobResult, patch]);

  const sequence = state.editSequence;
  const editGraph = state.editGraph;
  const hasDirector = !!state.director?.storyboard?.length;

  const patchEditGraph = useCallback(
    (graph: EditGraph) => {
      patch({
        editGraph: graph,
        editSequence: graphToSequence(graph),
      });
    },
    [patch]
  );

  const framesSig = useMemo(() => JSON.stringify(state.shotFrames ?? {}), [state.shotFrames]);
  const batchSig = useMemo(() => JSON.stringify(state.batchResults ?? {}), [state.batchResults]);
  const directorSig = useMemo(
    () =>
      JSON.stringify(
        state.director?.storyboard?.map((s) => [
          s.shotId,
          s.beatId,
          s.action,
          s.narration,
          s.reaction,
        ]) ?? []
      ),
    [state.director?.storyboard]
  );

  const syncEditGraph = useCallback(() => {
    const cur = getT2VState();
    const next = refreshEditGraphFromWorkbench(cur);
    if (!next) return null;
    if (!cur.editGraph || editGraphAssetsDiffer(cur.editGraph, next)) {
      patchEditGraph(next);
    }
    return next;
  }, [patchEditGraph]);

  /** @deprecated 兼容 render API */
  const syncEditAssets = useCallback(() => {
    const graph = syncEditGraph();
    return graph ? graphToSequence(graph) : refreshEditSequenceFromWorkbench(getT2VState());
  }, [syncEditGraph]);

  useEffect(() => {
    if (!hasDirector) return;
    const cur = getT2VState();
    if (isEditGraphStale(cur)) {
      const next = refreshEditGraphFromWorkbench(cur);
      if (next) {
        patchEditGraph(next);
        return;
      }
    }
    const next = refreshEditGraphFromWorkbench(cur);
    if (!next) return;
    if (
      !cur.editGraph ||
      editGraphAssetsDiffer(cur.editGraph, next) ||
      derivedTracksDiffer(cur.editGraph, next)
    ) {
      patchEditGraph(next);
    } else if (!cur.editSequence) {
      patch({ editSequence: graphToSequence(cur.editGraph) });
    }
  }, [framesSig, batchSig, directorSig, hasDirector, patchEditGraph, patch]);

  const missingCount = useMemo(() => {
    if (!sequence) return 0;
    return sequence.playOrder.filter((k) => sequence.clips[k]?.sourceKind === "missing").length;
  }, [sequence]);

  const ensureDefaultGraph = useCallback(() => syncEditGraph(), [syncEditGraph]);

  const openEditTab = useCallback(() => {
    syncEditGraph();
    patchCanvasUi({ shellLayout: "fusion", shellTab: "canvas", editDockOpen: true });
  }, [syncEditGraph, patchCanvasUi]);

  const handleEngineSettingsChange = useCallback(
    (partial: Partial<EditEngineSettings>) => {
      const cur = getT2VState();
      const base = cur.editEngineSettings ?? mergeEditEngineSettings();
      const next = mergeEditEngineSettings({ ...base, ...partial });
      patch({
        editEngineSettings: next,
        editVoiceId: next.voice.voiceId,
      });
    },
    [patch]
  );

  const applyTimelinePatch = useCallback(
    (timeline: EditGraph["timeline"]) => {
      const cur = getT2VState();
      const graph = cur.editGraph;
      if (!graph) return;
      const input = buildEditInputFromWorkbench(cur);
      if (!input) return;
      const { timeline: withTracks, scriptMap } = rebuildDerivedTracks(timeline, input);
      patchEditGraph({
        ...graph,
        timeline: syncClipSpecDurations(withTracks),
        scriptMap,
        updatedAt: new Date().toISOString(),
      });
    },
    [patchEditGraph]
  );

  const handleApplyPlan = useCallback(
    (planId: string) => {
      const cur = getT2VState();
      const graph = cur.editGraph;
      if (!graph) return;
      const plan = graph.plans.find((p) => p.id === planId);
      if (!plan) return;
      const input = buildEditInputFromWorkbench(cur);
      if (!input) return;
      const { timeline: withTracks, scriptMap } = rebuildDerivedTracks(plan.timeline, input);
      patchEditGraph({
        ...graph,
        timeline: withTracks,
        scriptMap,
        activePlanId: planId,
        pacingProfile: plan.pacingProfile,
        updatedAt: new Date().toISOString(),
      });
    },
    [patchEditGraph]
  );

  /** 仅在纯画布模式下才平移视口；融合/剪辑模式只同步选中态，不抢焦点 */
  const panCanvasToShotIfNeeded = useCallback((shotIndex: number) => {
    const curLayout = getT2VState().canvasUi.shellLayout ?? "fusion";
    if (curLayout !== "canvas") return;
    setFocusShotIndex(shotIndex);
    setFocusToken((t) => t + 1);
  }, []);

  const handleFocusShot = useCallback(
    (shotIndex: number) => {
      patch({ activeShotIdx: shotIndex });
      patchCanvasUi({ canvasSelectedKeys: [`shot-${shotIndex}`] });
      panCanvasToShotIfNeeded(shotIndex);
    },
    [patch, patchCanvasUi, panCanvasToShotIfNeeded]
  );

  const handleSelectClip = useCallback(
    (clip: TimelineClip) => {
      const idx = clip.video?.shotIndex;
      patchCanvasUi({ activeClipId: clip.id, playheadSec: clip.startSec });
      if (idx !== undefined) {
        patch({ activeShotIdx: idx });
        patchCanvasUi({ canvasSelectedKeys: [`shot-${idx}`] });
        panCanvasToShotIfNeeded(idx);
      }
    },
    [patch, patchCanvasUi, panCanvasToShotIfNeeded]
  );

  const handleSelectMedia = useCallback(
    (item: MediaPoolItem) => {
      if (item.shotIndex !== undefined) {
        patch({ activeShotIdx: item.shotIndex });
        const cur = getT2VState();
        const clip = cur.editGraph?.timeline.video.find(
          (c) => c.video?.shotIndex === item.shotIndex
        );
        if (clip) {
          patchCanvasUi({ activeClipId: clip.id, playheadSec: clip.startSec });
        }
        patchCanvasUi({ canvasSelectedKeys: [`shot-${item.shotIndex}`] });
        panCanvasToShotIfNeeded(item.shotIndex);
      }
    },
    [patch, patchCanvasUi, panCanvasToShotIfNeeded]
  );

  const handleReorder = useCallback(
    (from: number, to: number) => {
      const cur = getT2VState();
      if (!cur.editGraph) return;
      applyTimelinePatch(reorderTimelineVideo(cur.editGraph.timeline, from, to));
    },
    [applyTimelinePatch]
  );

  const handleDurationChange = useCallback(
    (clipId: string, sec: number) => {
      const cur = getT2VState();
      if (!cur.editGraph) return;
      applyTimelinePatch(updateTimelineClipDuration(cur.editGraph.timeline, clipId, sec));
    },
    [applyTimelinePatch]
  );

  useEffect(() => {
    if (!editGraph || layout === "canvas") return;
    const idx = state.activeShotIdx;
    if (idx === undefined || idx < 0) return;
    const clip = editGraph.timeline.video.find((c) => c.video?.shotIndex === idx);
    if (clip && state.canvasUi.activeClipId !== clip.id) {
      patchCanvasUi({
        activeClipId: clip.id,
        playheadSec: clip.startSec,
      });
    }
  }, [state.activeShotIdx, editGraph, layout, patchCanvasUi, state.canvasUi.activeClipId]);

  const runAlignScript = useCallback(async () => {
    setAlignLoading(true);
    patch({ editError: null });
    try {
      const res = await fetch("/api/auto-edit/align-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workbench: getT2VState() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "对齐失败");
      const cur = getT2VState();
      if (cur.editGraph) {
        patchEditGraph({ ...cur.editGraph, scriptMap: data.scriptMap });
      }
    } catch (err) {
      patch({ editError: err instanceof Error ? err.message : String(err) });
    } finally {
      setAlignLoading(false);
    }
  }, [patch, patchEditGraph]);

  const applyBgmRecommendation = useCallback(
    async (url: string, rationale?: string) => {
      patch({ editBgmUrl: url, editError: null });
      const cur = getT2VState();
      if (cur.editGraph) {
        const next = injectBgmIntoGraph(cur.editGraph, url, cur.editBgmVolume);
        if (next) patchEditGraph(next);
      }
      if (rationale) window.alert(rationale);
    },
    [patch, patchEditGraph]
  );

  const runRecommendBgm = useCallback(async () => {
    setBgmRecommendLoading(true);
    patch({ editError: null });
    try {
      const res = await fetch("/api/auto-edit/recommend-bgm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workbench: getT2VState() }),
      });
      const data = (await res.json()) as {
        recommendation?: { url: string; rationale: string; label: string };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "BGM 推荐失败");
      if (!data.recommendation?.url) throw new Error("推荐结果无效");
      await applyBgmRecommendation(data.recommendation.url, data.recommendation.rationale);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patch({ editError: msg });
      window.alert(msg);
    } finally {
      setBgmRecommendLoading(false);
    }
  }, [patch, applyBgmRecommendation]);

  const runApplyDefaultTransitions = useCallback(() => {
    setTransitionApplyLoading(true);
    try {
      const cur = getT2VState();
      const graph = cur.editGraph;
      if (!graph) throw new Error("请先生成剪辑时间线");
      const settings = mergeEditEngineSettings(cur.editEngineSettings);
      const timeline = applyDefaultTransitionsToTimeline(graph.timeline, {
        type: settings.transition.defaultType,
        durationMs: settings.transition.defaultDurationMs,
      });
      patchEditGraph({
        ...graph,
        timeline,
        updatedAt: new Date().toISOString(),
      });
      window.alert(`已应用默认转场：${settings.transition.defaultType}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patch({ editError: msg });
      window.alert(msg);
    } finally {
      setTransitionApplyLoading(false);
    }
  }, [patch, patchEditGraph]);

  const handleTransitionChange = useCallback(
    (afterClipId: string, patchTr: { type: TransitionType; durationMs: number }) => {
      const cur = getT2VState();
      const graph = cur.editGraph;
      if (!graph) return;
      patchEditGraph({
        ...graph,
        timeline: updateTimelineTransition(graph.timeline, afterClipId, patchTr),
        updatedAt: new Date().toISOString(),
      });
    },
    [patchEditGraph]
  );

  const runApplyBeatSync = useCallback(() => {
    setBeatApplyLoading(true);
    try {
      const cur = getT2VState();
      const graph = cur.editGraph;
      if (!graph) throw new Error("请先生成剪辑时间线");
      const settings = mergeEditEngineSettings(cur.editEngineSettings);
      const input = buildEditInputFromWorkbench(cur);
      if (!input) throw new Error("无法读取工作台数据");

      let timeline = applyBeatSyncToTimeline(graph.timeline, settings.storyGraph.bpm);
      const { timeline: withTracks, scriptMap } = rebuildDerivedTracks(timeline, input);
      patchEditGraph({
        ...graph,
        timeline: syncClipSpecDurations(withTracks),
        scriptMap,
        updatedAt: new Date().toISOString(),
      });
      window.alert(`已按 ${settings.storyGraph.bpm} BPM 对齐镜长`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patch({ editError: msg });
      window.alert(msg);
    } finally {
      setBeatApplyLoading(false);
    }
  }, [patch, patchEditGraph]);

  const runGenerateSpokenNarration = useCallback(async () => {
    setNarrationLoading(true);
    patch({ editError: null });
    try {
      const res = await fetch("/api/auto-edit/spoken-narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workbench: getT2VState() }),
      });
      const data = (await res.json()) as {
        storyboard?: import("@/app/lib/workbench-persist/types").StoryboardShot[];
        editGraph?: EditGraph;
        shotCount?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "口播稿生成失败");

      const cur = getT2VState();
      if (data.storyboard && cur.director) {
        patch({
          director: { ...cur.director, storyboard: data.storyboard },
        });
      }
      if (data.editGraph) {
        patchEditGraph(data.editGraph);
      }
      window.alert(`已为 ${data.shotCount ?? 0} 个镜头生成口语口播稿，请前往「配音中心」合成配音`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patch({ editError: msg });
      window.alert(msg);
    } finally {
      setNarrationLoading(false);
    }
  }, [patch, patchEditGraph]);

  const handleBgmUpload = useCallback(
    async (file: File) => {
      patch({ editError: null });
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/auto-edit/upload-bgm", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "上传失败");
        patch({ editBgmUrl: data.url });
        const cur = getT2VState();
        if (cur.editGraph) {
          const next = injectBgmIntoGraph(cur.editGraph, data.url, cur.editBgmVolume);
          if (next) patchEditGraph(next);
        }
      } catch (err) {
        patch({ editError: err instanceof Error ? err.message : String(err) });
      }
    },
    [patch, patchEditGraph]
  );

  const handleBgmVolume = useCallback(
    (v: number) => {
      patch({ editBgmVolume: v });
      const cur = getT2VState();
      if (cur.editGraph && cur.editBgmUrl) {
        const next = injectBgmIntoGraph(cur.editGraph, cur.editBgmUrl, v);
        if (next) patchEditGraph(next);
      }
    },
    [patch, patchEditGraph]
  );

  const runAiPlan = useCallback(async () => {
    setPlanLoading(true);
    patch({ editError: null });
    try {
      const res = await fetch("/api/auto-edit/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workbench: getT2VState(), useAi: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失败");

      const input = buildEditInputFromWorkbench(getT2VState());
      if (!input) throw new Error("无法读取工作台数据");

      const variant = createPlanVariantFromApi(
        data.plan,
        data.sequence,
        input,
        `AI 方案 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
      );
      const cur = getT2VState();
      const baseGraph = cur.editGraph ?? migrateToEditGraph(cur, data.sequence);
      if (!baseGraph) throw new Error("无法初始化 Edit Graph");

      const { timeline: withTracks, scriptMap } = rebuildDerivedTracks(
        variant.timeline,
        input
      );

      patchEditGraph({
        ...baseGraph,
        timeline: syncClipSpecDurations(withTracks),
        scriptMap,
        plans: [...baseGraph.plans, variant],
        activePlanId: variant.id,
        pacingProfile: variant.pacingProfile,
        updatedAt: new Date().toISOString(),
      });
      patch({ editPlan: data.plan });

      const settings = mergeEditEngineSettings(getT2VState().editEngineSettings);
      if (settings.music.autoRecommend) {
        void runRecommendBgm();
      }
    } catch (err) {
      patch({ editError: err instanceof Error ? err.message : String(err) });
    } finally {
      setPlanLoading(false);
    }
  }, [patch, patchEditGraph, runRecommendBgm]);

  const runRender = useCallback(async () => {
    const seq = syncEditAssets();
    if (!seq) return;
    patch({
      editRendering: true,
      editError: null,
      finalEditVideoUrl: null,
      editRenderProgress: { pct: 0, message: "渲染引擎准备中…" },
    });
    setRenderProgress({ pct: 0, message: "渲染引擎准备中…" });
    try {
      const res = await fetch("/api/auto-edit/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workbench: getT2VState(), sequence: seq, mode: renderMode }),
      });
      const data = (await res.json()) as { jobId?: string; error?: string };
      if (!res.ok || !data.jobId) throw new Error(data.error ?? "渲染启动失败");

      patch({ editRenderJobId: data.jobId });
    } catch (err) {
      patch({
        editRendering: false,
        editRenderProgress: null,
        editError: err instanceof Error ? err.message : String(err),
      });
      setRenderProgress({ pct: 0, message: "" });
    }
  }, [syncEditAssets, patch, renderMode]);

  const onFocusHandled = useCallback(() => setFocusShotIndex(null), []);

  const effectiveRenderProgress = state.editRenderProgress ?? renderProgress;

  const fusionHandlers = useMemo(
    () =>
      editGraph
        ? {
            planLoading,
            alignLoading,
            narrationLoading,
            bgmRecommendLoading,
            transitionApplyLoading,
            beatApplyLoading,
            renderMode,
            renderProgress: effectiveRenderProgress,
            onPatchWorkbench: patch,
            onPatchGraph: patchEditGraph,
            onPatchCanvasUi: patchCanvasUi,
            onRenderMode: setRenderMode,
            onGeneratePlan: runAiPlan,
            onSyncAssets: syncEditGraph,
            onGenerateSpokenNarration: runGenerateSpokenNarration,
            onRecommendBgm: runRecommendBgm,
            onApplyDefaultTransitions: runApplyDefaultTransitions,
            onApplyBeatSync: runApplyBeatSync,
            onTransitionChange: handleTransitionChange,
            onBgmUpload: handleBgmUpload,
            onBgmVolume: handleBgmVolume,
            onRender: runRender,
            onFocusShot: handleFocusShot,
            onApplyPlan: handleApplyPlan,
            onReorder: handleReorder,
            onDurationChange: handleDurationChange,
            onSelectClip: handleSelectClip,
            onSelectMedia: handleSelectMedia,
            onEngineSettingsChange: handleEngineSettingsChange,
            dragIdx,
            onDragIdx: setDragIdx,
            focusShotIndex,
            focusToken,
            onFocusHandled,
          }
        : null,
    [
      editGraph,
      planLoading,
      alignLoading,
      narrationLoading,
      bgmRecommendLoading,
      transitionApplyLoading,
      beatApplyLoading,
      renderMode,
      effectiveRenderProgress,
      patch,
      patchEditGraph,
      patchCanvasUi,
      setRenderMode,
      runAiPlan,
      syncEditGraph,
      runGenerateSpokenNarration,
      runRecommendBgm,
      runApplyDefaultTransitions,
      runApplyBeatSync,
      handleTransitionChange,
      handleBgmUpload,
      handleBgmVolume,
      runRender,
      handleFocusShot,
      handleApplyPlan,
      handleReorder,
      handleDurationChange,
      handleSelectClip,
      handleSelectMedia,
      handleEngineSettingsChange,
      dragIdx,
      focusShotIndex,
      focusToken,
      onFocusHandled,
    ]
  );

  const layoutSwitcher = advancedOnly ? null : (
    <LayoutTabs layout={layout} onLayout={setLayout} onOpenFusion={openEditTab} />
  );

  if (advancedOnly) {
    return (
      <div className="relative h-full min-h-0">
        {!hasDirector ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-secondary)]">
            请先在「创作中心」运行编导
          </div>
        ) : !editGraph ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-sm text-[var(--text-secondary)]">尚未建立剪辑工程</p>
            <Link href="/ai-edit" className="btn-primary rounded-lg px-4 py-2 text-sm">
              返回 AI 剪辑
            </Link>
          </div>
        ) : (
          <EditCenterShell
            state={state}
            graph={editGraph}
            planLoading={planLoading}
            alignLoading={alignLoading}
            narrationLoading={narrationLoading}
            bgmRecommendLoading={bgmRecommendLoading}
            transitionApplyLoading={transitionApplyLoading}
            beatApplyLoading={beatApplyLoading}
            renderMode={renderMode}
            renderProgress={renderProgress}
            onPatchWorkbench={patch}
            onPatchCanvasUi={patchCanvasUi}
            onPatchGraph={patchEditGraph}
            onRenderMode={setRenderMode}
            onGeneratePlan={runAiPlan}
            onSyncAssets={syncEditGraph}
            onAlignScript={runAlignScript}
            onGenerateSpokenNarration={runGenerateSpokenNarration}
            onRecommendBgm={runRecommendBgm}
            onApplyDefaultTransitions={runApplyDefaultTransitions}
            onApplyBeatSync={runApplyBeatSync}
            onTransitionChange={handleTransitionChange}
            onBgmUpload={handleBgmUpload}
            onBgmVolume={handleBgmVolume}
            onRender={runRender}
            onFocusShot={handleFocusShot}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0">
      {layout === "canvas" ? (
        <>
          <ProjectCanvas
            immersive
            focusShotIndex={focusShotIndex}
            focusToken={focusToken}
            onFocusHandled={() => setFocusShotIndex(null)}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center px-4 pt-3">
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/95 px-3 py-1.5 shadow-lg backdrop-blur">
              {layoutSwitcher}
              {sequence && (
                <span className="hidden text-xs text-[var(--text-caption)] sm:inline">
                  {sequence.totalDurationSec.toFixed(1)} 秒 · {sequence.playOrder.length} 镜
                  {missingCount > 0 && (
                    <span className="ml-1 text-[var(--danger)]">缺 {missingCount}</span>
                  )}
                </span>
              )}
            </div>
          </div>
          {hasDirector && (
            <MiniTimelineBar sequence={sequence} onOpenEdit={openEditTab} />
          )}
        </>
      ) : layout === "fusion" ? (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {!hasDirector ? (
            <div className="flex h-full flex-col">
              <div className="shrink-0 border-b border-[var(--border)] px-4 py-2">{layoutSwitcher}</div>
              <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-secondary)]">
                请先在「创作中心」运行编导，再使用融合视图
              </div>
            </div>
          ) : !editGraph ? (
            <div className="flex h-full flex-col">
              <div className="shrink-0 border-b border-[var(--border)] px-4 py-2">{layoutSwitcher}</div>
              <div className="relative min-h-0 flex-1">
                <ProjectCanvas immersive />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center shadow-lg">
                    <p className="text-sm text-[var(--text-secondary)]">尚未建立剪辑时间线</p>
                    <button
                      type="button"
                      onClick={ensureDefaultGraph}
                      className="btn-primary mt-3 rounded-lg px-4 py-2 text-sm"
                    >
                      从分镜初始化
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : fusionHandlers ? (
            <FusionShell
              state={state}
              graph={editGraph}
              handlers={fusionHandlers}
              headerLeading={layoutSwitcher}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LayoutTabs({
  layout,
  onLayout,
  onOpenFusion,
}: {
  layout: CanvasShellLayout;
  onLayout: (t: CanvasShellLayout) => void;
  onOpenFusion: () => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-[var(--bg-inset)] p-1">
      <button
        type="button"
        onClick={() => onLayout("canvas")}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm ${
          layout === "canvas" ? "nav-item-active font-semibold" : "text-[var(--text-secondary)]"
        }`}
      >
        <FiGrid className="h-4 w-4" /> 画布
      </button>
      <button
        type="button"
        onClick={() => {
          onOpenFusion();
          onLayout("fusion");
        }}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm ${
          layout === "fusion" ? "nav-item-active font-semibold" : "text-[var(--text-secondary)]"
        }`}
      >
        <FiFilm className="h-4 w-4" /> 融合
      </button>
    </div>
  );
}
