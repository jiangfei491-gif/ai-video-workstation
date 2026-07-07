"use client";

import { useCallback, useMemo } from "react";
import { FiX } from "react-icons/fi";
import type { T2VWorkbenchState, CanvasUiState } from "@/app/lib/workbench-persist/types";
import type { EditGraph, MediaPoolItem, TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";
import type { EditRenderMode } from "@/app/lib/auto-edit/types";
import type { EditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";
import { mergeEditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";
import {
  buildVoicePreviewSources,
  resolveScrubVideoAtPlayhead,
  resolveSubtitleAtPlayhead,
} from "@/app/lib/auto-edit/timeline-preview";
import ProjectCanvas from "@/app/components/workflows/canvas/ProjectCanvas";
import EditTopBar from "./EditTopBar";
import EditInspectorPanel from "./EditInspectorPanel";
import EditWorkflowPanel from "./EditWorkflowPanel";
import PreviewPanel from "./PreviewPanel";
import MultiTrackTimeline from "./MultiTrackTimeline";
import EditLibraryPanel, { type EditLibraryTab } from "./EditLibraryPanel";
import EditLibraryContent from "./EditLibraryContent";
import TimelineToolbar from "./TimelineToolbar";

type EditHandlers = {
  planLoading: boolean;
  alignLoading: boolean;
  narrationLoading: boolean;
  bgmRecommendLoading: boolean;
  transitionApplyLoading: boolean;
  beatApplyLoading: boolean;
  renderMode: EditRenderMode;
  renderProgress: { pct: number; message: string };
  onPatchWorkbench: (patch: Partial<T2VWorkbenchState>) => void;
  onPatchGraph: (graph: EditGraph) => void;
  onPatchCanvasUi: (patch: Partial<CanvasUiState>) => void;
  onRenderMode: (m: EditRenderMode) => void;
  onGeneratePlan: () => void;
  onSyncAssets: () => void;
  onGenerateSpokenNarration: () => void;
  onBgmUpload: (file: File) => void;
  onBgmVolume: (v: number) => void;
  onRecommendBgm: () => void;
  onApplyDefaultTransitions: () => void;
  onApplyBeatSync: () => void;
  onTransitionChange: (afterClipId: string, patch: { type: import("@/app/lib/auto-edit/types").TransitionType; durationMs: number }) => void;
  onRender: () => void;
  onFocusShot?: (shotIndex: number) => void;
  onApplyPlan: (planId: string) => void;
  onReorder: (from: number, to: number) => void;
  onDurationChange: (clipId: string, sec: number) => void;
  onSelectClip: (clip: TimelineClip) => void;
  onSelectMedia: (item: MediaPoolItem) => void;
  onEngineSettingsChange: (patch: Partial<EditEngineSettings>) => void;
  dragIdx: number | null;
  onDragIdx: (i: number | null) => void;
  focusShotIndex: number | null;
  focusToken: number;
  onFocusHandled: () => void;
};

type Props = {
  state: T2VWorkbenchState;
  graph: EditGraph;
  handlers: EditHandlers;
  headerLeading?: React.ReactNode;
};

/**
 * 剪映式 NLE 四象限：
 * 左上素材库 | 中上播放器 | 右上属性
 * 底部全宽时间轴 + 工具栏
 */
export default function FusionShell({ state, graph, handlers, headerLeading }: Props) {
  const canvasUi = state.canvasUi;
  const playheadSec = canvasUi.playheadSec;
  const activeClipId = canvasUi.activeClipId;
  const libraryTab = canvasUi.editLibraryTab ?? "media";
  const timelineZoom = canvasUi.editTimelineZoom ?? 1;
  const nleCanvasOverlay = canvasUi.nleCanvasOverlay ?? false;

  const engineSettings = state.editEngineSettings ?? mergeEditEngineSettings();
  const projectName =
    state.director?.title?.trim().replace(/\s+/g, "-") || "edit-project";

  const sections = state.canvasSections.map((s) => ({ id: s.id, title: s.title }));
  const activeShotIndex = state.activeShotIdx ?? null;

  const setPlayheadSec = useCallback(
    (sec: number) => handlers.onPatchCanvasUi({ playheadSec: sec }),
    [handlers.onPatchCanvasUi]
  );

  const setLibraryTab = useCallback(
    (tab: EditLibraryTab) => handlers.onPatchCanvasUi({ editLibraryTab: tab }),
    [handlers.onPatchCanvasUi]
  );

  const setTimelineZoom = useCallback(
    (z: number) => handlers.onPatchCanvasUi({ editTimelineZoom: z }),
    [handlers.onPatchCanvasUi]
  );

  const openCanvas = useCallback(
    () => handlers.onPatchCanvasUi({ nleCanvasOverlay: true }),
    [handlers.onPatchCanvasUi]
  );

  const closeCanvas = useCallback(
    () => handlers.onPatchCanvasUi({ nleCanvasOverlay: false }),
    [handlers.onPatchCanvasUi]
  );

  const activeClip = useMemo(() => {
    if (activeClipId) {
      const tracks = [
        ...graph.timeline.video,
        ...graph.timeline.voice,
        ...graph.timeline.music,
        ...graph.timeline.subtitle,
      ];
      return tracks.find((c) => c.id === activeClipId) ?? null;
    }
    for (const clip of graph.timeline.video) {
      if (
        playheadSec >= clip.startSec &&
        playheadSec < clip.startSec + clip.durationSec
      ) {
        return clip;
      }
    }
    return null;
  }, [activeClipId, graph.timeline, playheadSec]);

  const activePlan =
    graph.plans.find((p) => p.id === graph.activePlanId) ?? graph.plans[graph.plans.length - 1];

  const transitionAfter = useMemo(() => {
    if (!activeClip || activeClip.track !== "video") return null;
    const tr = graph.timeline.transitions.find((t) => t.afterClipId === activeClip.id);
    if (!tr) return null;
    return { type: tr.type, durationMs: tr.durationMs, rationale: tr.rationale };
  }, [activeClip, graph.timeline.transitions]);

  const inspectorMedia = useMemo(() => {
    if (!activeClip?.mediaRefId) {
      const idx = activeClip?.video?.shotIndex;
      if (idx === undefined) return null;
      return (
        graph.mediaPool.find((p) => p.shotIndex === idx && p.kind === "video") ??
        graph.mediaPool.find((p) => p.shotIndex === idx && p.kind === "image") ??
        null
      );
    }
    return graph.mediaPool.find((p) => p.id === activeClip.mediaRefId) ?? null;
  }, [activeClip, graph.mediaPool]);

  const previewFrameUrl = useMemo(() => {
    const idx = activeClip?.video?.shotIndex ?? state.activeShotIdx;
    if (idx === undefined || idx < 0) return null;
    const batch = state.batchResults[idx];
    if (batch?.firstFrameUrl) return batch.firstFrameUrl;
    return state.shotFrames[idx] ?? null;
  }, [activeClip, state.activeShotIdx, state.batchResults, state.shotFrames]);

  const voiceSources = useMemo(
    () => buildVoicePreviewSources(graph.timeline.voice, graph.mediaPool),
    [graph.timeline.voice, graph.mediaPool]
  );

  const subtitleText = useMemo(
    () => resolveSubtitleAtPlayhead(graph.timeline.subtitle, playheadSec),
    [graph.timeline.subtitle, playheadSec]
  );

  const scrubVideo = useMemo(
    () => resolveScrubVideoAtPlayhead(graph.timeline.video, state.batchResults, playheadSec),
    [graph.timeline.video, state.batchResults, playheadSec]
  );

  const missingCount = useMemo(
    () => graph.timeline.video.filter((c) => c.video?.sourceKind === "missing").length,
    [graph.timeline.video]
  );

  const currentLabel = activeClip?.label ?? null;

  const aiPanel = (
    <EditWorkflowPanel
      state={state}
      plans={graph.plans}
      activePlanId={graph.activePlanId}
      mediaPool={graph.mediaPool}
      renderMode={handlers.renderMode}
      planLoading={handlers.planLoading}
      narrationLoading={handlers.narrationLoading}
      bgmRecommendLoading={handlers.bgmRecommendLoading}
      transitionApplyLoading={handlers.transitionApplyLoading}
      beatApplyLoading={handlers.beatApplyLoading}
      bgmUrl={state.editBgmUrl}
      bgmVolume={state.editBgmVolume}
      engineSettings={engineSettings}
      projectName={projectName}
      missingCount={missingCount}
      editRendering={state.editRendering}
      renderProgress={handlers.renderProgress}
      editError={state.editError}
      finalEditVideoUrl={state.finalEditVideoUrl}
      activeShotIndex={activeShotIndex}
      onRenderMode={handlers.onRenderMode}
      onGeneratePlan={handlers.onGeneratePlan}
      onApplyPlan={handlers.onApplyPlan}
      onSyncAssets={handlers.onSyncAssets}
      onGenerateSpokenNarration={handlers.onGenerateSpokenNarration}
      onRecommendBgm={handlers.onRecommendBgm}
      onApplyDefaultTransitions={handlers.onApplyDefaultTransitions}
      onApplyBeatSync={handlers.onApplyBeatSync}
      onFocusShot={handlers.onFocusShot}
      onBgmUpload={handlers.onBgmUpload}
      onBgmVolume={handlers.onBgmVolume}
      onSettingsChange={handlers.onEngineSettingsChange}
      onSelectMedia={handlers.onSelectMedia}
    />
  );

  return (
    <div className="nle-shell fusion-shell flex h-full min-h-0 flex-col overflow-hidden">
      <EditTopBar
        leading={headerLeading}
        projectTitle={state.director?.title ?? projectName}
        durationSec={graph.timeline.durationSec}
        shotCount={graph.timeline.video.length}
        missingCount={missingCount}
        editRendering={state.editRendering}
        renderProgressPct={handlers.renderProgress.pct}
        hasPlans={graph.plans.length > 0 || graph.timeline.video.length > 0}
        onRender={handlers.onRender}
      />

      <div className="nle-upper flex min-h-0 flex-1 overflow-hidden">
        <EditLibraryPanel
          tab={libraryTab}
          onTab={setLibraryTab}
          showScript={false}
          showStoryboard
        >
          <EditLibraryContent
            tab={libraryTab}
            mediaPool={graph.mediaPool}
            activeShotIndex={activeShotIndex}
            onSelectMedia={handlers.onSelectMedia}
            onSyncAssets={handlers.onSyncAssets}
            bgmUrl={state.editBgmUrl}
            subtitleClips={graph.timeline.subtitle}
            videoClips={graph.timeline.video}
            shotFrames={state.shotFrames}
            batchResults={state.batchResults}
            onOpenCanvas={openCanvas}
            onFocusShot={handlers.onFocusShot}
            aiPanel={aiPanel}
          />
        </EditLibraryPanel>

        <main className="nle-player min-w-0 flex-1 overflow-hidden">
          <PreviewPanel
            playerTitle="播放器"
            finalEditVideoUrl={state.finalEditVideoUrl}
            editRendering={state.editRendering}
            renderProgress={handlers.renderProgress}
            playheadSec={playheadSec}
            durationSec={graph.timeline.durationSec}
            currentLabel={currentLabel}
            previewFrameUrl={previewFrameUrl}
            scrubVideoUrl={scrubVideo?.videoUrl ?? null}
            scrubVideoOffsetSec={scrubVideo?.clipOffsetSec ?? 0}
            voiceSources={voiceSources}
            subtitleText={subtitleText}
            bgmUrl={state.editBgmUrl}
            bgmVolume={state.editBgmVolume}
            duckUnderVoice={engineSettings.music.duckUnderVoice}
            duckAmount={engineSettings.music.duckAmount}
            onSeek={setPlayheadSec}
          />
        </main>

        <aside className="nle-inspector flex w-[min(100%,300px)] shrink-0 flex-col border-l border-[var(--border-strong)] bg-[var(--bg-surface)] lg:w-[320px]">
          <div className="shrink-0 border-b border-[var(--border)] px-3 py-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">属性</p>
            <p className="text-[10px] text-[var(--text-caption)]">选中片段的参数与转场</p>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <EditInspectorPanel
              clip={activeClip}
              mediaItem={inspectorMedia}
              activePlan={activePlan}
              transitionAfter={transitionAfter}
              onTransitionChange={
                activeClip?.track === "video"
                  ? (patch) => handlers.onTransitionChange(activeClip.id, patch)
                  : undefined
              }
            />
          </div>
        </aside>
      </div>

      <div className="nle-timeline-wrap flex h-[min(42vh,300px)] shrink-0 flex-col border-t border-[var(--border-strong)]">
        <TimelineToolbar
          playheadSec={playheadSec}
          durationSec={graph.timeline.durationSec}
          onSyncAssets={handlers.onSyncAssets}
          zoom={timelineZoom}
          onZoom={setTimelineZoom}
        />
        <div className="min-h-0 flex-1">
          <MultiTrackTimeline
            timeline={graph.timeline}
            sections={sections}
            activeClipId={activeClipId}
            playheadSec={playheadSec}
            dragIdx={handlers.dragIdx}
            onDragIdx={handlers.onDragIdx}
            onReorder={handlers.onReorder}
            onDurationChange={handlers.onDurationChange}
            onSelectClip={handlers.onSelectClip}
            onSeek={setPlayheadSec}
            pxScale={timelineZoom}
            hideHeader
          />
        </div>
      </div>

      {nleCanvasOverlay && (
        <div className="nle-canvas-overlay absolute inset-0 z-50 flex flex-col bg-[var(--bg-inset)]">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">分镜画布</p>
              <p className="text-xs text-[var(--text-caption)]">调整分镜与素材关联后关闭返回剪辑台</p>
            </div>
            <button type="button" onClick={closeCanvas} className="edit-icon-btn" title="关闭画布">
              <FiX className="h-5 w-5" />
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <ProjectCanvas
              immersive
              reserveBottomChrome={false}
              focusShotIndex={handlers.focusShotIndex}
              focusToken={handlers.focusToken}
              onFocusHandled={handlers.onFocusHandled}
            />
          </div>
        </div>
      )}
    </div>
  );
}
