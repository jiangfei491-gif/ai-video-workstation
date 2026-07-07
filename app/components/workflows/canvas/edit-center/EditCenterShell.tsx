"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { T2VWorkbenchState, CanvasUiState } from "@/app/lib/workbench-persist/types";
import type {
  EditGraph,
  MediaPoolItem,
  ScriptSegment,
  TimelineClip,
} from "@/app/lib/auto-edit/edit-graph/types";
import {
  rebuildDerivedTracks,
  reorderTimelineVideo,
  syncClipSpecDurations,
  updateTimelineClipDuration,
  updateTimelineTransition,
} from "@/app/lib/auto-edit/edit-graph";
import {
  buildEditInputFromWorkbench,
  resolveProjectScript,
  resolveProjectScriptLabel,
} from "@/app/lib/auto-edit/workbench-bridge";
import { mergeEditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";
import type { EditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";
import type { EditRenderMode, TransitionType } from "@/app/lib/auto-edit/types";
import {
  buildVoicePreviewSources,
  resolveScrubVideoAtPlayhead,
  resolveSubtitleAtPlayhead,
} from "@/app/lib/auto-edit/timeline-preview";
import EditTopBar from "./EditTopBar";
import EditInspectorPanel from "./EditInspectorPanel";
import EditWorkflowPanel from "./EditWorkflowPanel";
import ScriptPanel from "./ScriptPanel";
import MultiTrackTimeline from "./MultiTrackTimeline";
import PreviewPanel from "./PreviewPanel";
import EditLibraryPanel, { type EditLibraryTab } from "./EditLibraryPanel";
import EditLibraryContent from "./EditLibraryContent";
import TimelineToolbar from "./TimelineToolbar";

type Props = {
  state: T2VWorkbenchState;
  graph: EditGraph;
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
  onRenderMode: (m: EditRenderMode) => void;
  onGeneratePlan: () => void;
  onSyncAssets: () => void;
  onAlignScript: () => void;
  onGenerateSpokenNarration: () => void;
  onRecommendBgm: () => void;
  onApplyDefaultTransitions: () => void;
  onApplyBeatSync: () => void;
  onTransitionChange: (afterClipId: string, patch: { type: TransitionType; durationMs: number }) => void;
  onBgmUpload: (file: File) => void;
  onBgmVolume: (v: number) => void;
  onRender: () => void;
  onFocusShot?: (shotIndex: number) => void;
  onPatchCanvasUi: (patch: Partial<CanvasUiState>) => void;
  headerLeading?: React.ReactNode;
};

export default function EditCenterShell({
  state,
  graph,
  planLoading,
  alignLoading,
  narrationLoading,
  bgmRecommendLoading,
  beatApplyLoading,
  transitionApplyLoading,
  renderMode,
  renderProgress,
  onPatchWorkbench,
  onPatchGraph,
  onRenderMode,
  onGeneratePlan,
  onSyncAssets,
  onAlignScript,
  onGenerateSpokenNarration,
  onRecommendBgm,
  onApplyDefaultTransitions,
  onApplyBeatSync,
  onTransitionChange,
  onBgmUpload,
  onBgmVolume,
  onRender,
  onFocusShot,
  onPatchCanvasUi,
  headerLeading,
}: Props) {
  const canvasUi = state.canvasUi;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const libraryTab = canvasUi.editLibraryTab ?? "media";
  const timelineZoom = canvasUi.editTimelineZoom ?? 1;

  const activeShotIndex = state.activeShotIdx ?? null;
  const activeClipId = canvasUi.activeClipId;
  const playheadSec = canvasUi.playheadSec;

  const engineSettings = state.editEngineSettings ?? mergeEditEngineSettings();
  const projectName =
    state.director?.title?.trim().replace(/\s+/g, "-") || "edit-project";

  const handleEngineSettingsChange = useCallback(
    (patch: Partial<EditEngineSettings>) => {
      const next = mergeEditEngineSettings({ ...engineSettings, ...patch });
      onPatchWorkbench({
        editEngineSettings: next,
        editVoiceId: next.voice.voiceId,
      });
    },
    [engineSettings, onPatchWorkbench]
  );

  const setPlayheadSec = useCallback(
    (sec: number) => onPatchCanvasUi({ playheadSec: sec }),
    [onPatchCanvasUi]
  );

  const setLibraryTab = useCallback(
    (tab: EditLibraryTab) => onPatchCanvasUi({ editLibraryTab: tab }),
    [onPatchCanvasUi]
  );

  const setTimelineZoom = useCallback(
    (z: number) => onPatchCanvasUi({ editTimelineZoom: z }),
    [onPatchCanvasUi]
  );

  useEffect(() => {
    const idx = state.activeShotIdx;
    if (idx === undefined || idx < 0) return;
    const clip = graph.timeline.video.find((c) => c.video?.shotIndex === idx);
    if (!clip || canvasUi.activeClipId === clip.id) return;
    onPatchCanvasUi({
      activeClipId: clip.id,
      playheadSec: clip.startSec,
    });
  }, [state.activeShotIdx, graph, canvasUi.activeClipId, onPatchCanvasUi]);

  const fullScript = resolveProjectScript(state);
  const scriptSourceLabel = resolveProjectScriptLabel(state);
  const sections = state.canvasSections.map((s) => ({ id: s.id, title: s.title }));

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

  const currentLabel = activeClip?.label ?? null;

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

  const applyTimelinePatch = useCallback(
    (timeline: EditGraph["timeline"]) => {
      const input = buildEditInputFromWorkbench(state);
      if (!input) return;
      const { timeline: withTracks, scriptMap } = rebuildDerivedTracks(timeline, input);
      onPatchGraph({
        ...graph,
        timeline: syncClipSpecDurations(withTracks),
        scriptMap,
        updatedAt: new Date().toISOString(),
      });
    },
    [graph, onPatchGraph, state]
  );

  const handleSelectSegment = useCallback(
    (seg: ScriptSegment) => {
      if (seg.shotIndex !== undefined) {
        onPatchWorkbench({ activeShotIdx: seg.shotIndex });
        onFocusShot?.(seg.shotIndex);
        const clip = graph.timeline.video.find((c) => c.video?.shotIndex === seg.shotIndex);
        if (clip) {
          onPatchCanvasUi({ activeClipId: clip.id, playheadSec: clip.startSec });
        } else if (seg.timelineStartSec !== undefined) {
          onPatchCanvasUi({ playheadSec: seg.timelineStartSec });
        }
      }
    },
    [graph.timeline.video, onFocusShot, onPatchCanvasUi, onPatchWorkbench]
  );

  const handleSelectItem = useCallback(
    (item: MediaPoolItem) => {
      if (item.shotIndex !== undefined) {
        onPatchWorkbench({ activeShotIdx: item.shotIndex });
        onFocusShot?.(item.shotIndex);
        const clip = graph.timeline.video.find((c) => c.video?.shotIndex === item.shotIndex);
        if (clip) {
          onPatchCanvasUi({ activeClipId: clip.id, playheadSec: clip.startSec });
        }
      }
    },
    [graph.timeline.video, onFocusShot, onPatchCanvasUi, onPatchWorkbench]
  );

  const handleSelectClip = useCallback(
    (clip: TimelineClip) => {
      const idx = clip.video?.shotIndex;
      onPatchCanvasUi({ activeClipId: clip.id, playheadSec: clip.startSec });
      if (idx !== undefined) {
        onPatchWorkbench({ activeShotIdx: idx });
        onFocusShot?.(idx);
      }
    },
    [onFocusShot, onPatchCanvasUi, onPatchWorkbench]
  );

  const handleReorder = useCallback(
    (from: number, to: number) => {
      applyTimelinePatch(reorderTimelineVideo(graph.timeline, from, to));
    },
    [applyTimelinePatch, graph.timeline]
  );

  const handleDurationChange = useCallback(
    (clipId: string, sec: number) => {
      applyTimelinePatch(updateTimelineClipDuration(graph.timeline, clipId, sec));
    },
    [applyTimelinePatch, graph.timeline]
  );

  const handleApplyPlan = useCallback(
    (planId: string) => {
      const plan = graph.plans.find((p) => p.id === planId);
      if (!plan) return;
      const input = buildEditInputFromWorkbench(state);
      if (!input) return;
      const { timeline: withTracks, scriptMap } = rebuildDerivedTracks(plan.timeline, input);
      onPatchGraph({
        ...graph,
        timeline: withTracks,
        scriptMap,
        activePlanId: planId,
        pacingProfile: plan.pacingProfile,
        updatedAt: new Date().toISOString(),
      });
    },
    [graph, onPatchGraph, state]
  );

  return (
    <div className="nle-shell edit-center flex h-full min-h-0 flex-col overflow-hidden">
      <EditTopBar
        leading={headerLeading}
        projectTitle={state.director?.title ?? projectName}
        durationSec={graph.timeline.durationSec}
        shotCount={graph.timeline.video.length}
        missingCount={missingCount}
        editRendering={state.editRendering}
        renderProgressPct={renderProgress.pct}
        hasPlans={graph.plans.length > 0 || graph.timeline.video.length > 0}
        onRender={onRender}
      />

      <div className="nle-upper flex min-h-0 flex-1 overflow-hidden">
        <EditLibraryPanel
          tab={libraryTab}
          onTab={setLibraryTab}
          showScript
          showStoryboard={false}
        >
          <EditLibraryContent
            tab={libraryTab}
            mediaPool={graph.mediaPool}
            activeShotIndex={activeShotIndex}
            onSelectMedia={handleSelectItem}
            onSyncAssets={onSyncAssets}
            bgmUrl={state.editBgmUrl}
            subtitleClips={graph.timeline.subtitle}
            videoClips={graph.timeline.video}
            shotFrames={state.shotFrames}
            batchResults={state.batchResults}
            onFocusShot={onFocusShot}
            aiPanel={
              <EditWorkflowPanel
                state={state}
                plans={graph.plans}
                activePlanId={graph.activePlanId}
                mediaPool={graph.mediaPool}
                renderMode={renderMode}
                planLoading={planLoading}
                narrationLoading={narrationLoading}
                bgmRecommendLoading={bgmRecommendLoading}
                transitionApplyLoading={transitionApplyLoading}
                beatApplyLoading={beatApplyLoading}
                bgmUrl={state.editBgmUrl}
                bgmVolume={state.editBgmVolume}
                engineSettings={engineSettings}
                projectName={projectName}
                missingCount={missingCount}
                editRendering={state.editRendering}
                renderProgress={renderProgress}
                editError={state.editError}
                finalEditVideoUrl={state.finalEditVideoUrl}
                activeShotIndex={activeShotIndex}
                onRenderMode={onRenderMode}
                onGeneratePlan={onGeneratePlan}
                onApplyPlan={handleApplyPlan}
                onSyncAssets={onSyncAssets}
                onGenerateSpokenNarration={onGenerateSpokenNarration}
                onRecommendBgm={onRecommendBgm}
                onApplyDefaultTransitions={onApplyDefaultTransitions}
                onApplyBeatSync={onApplyBeatSync}
                onFocusShot={onFocusShot}
                onBgmUpload={onBgmUpload}
                onBgmVolume={onBgmVolume}
                onSettingsChange={handleEngineSettingsChange}
                onSelectMedia={handleSelectItem}
              />
            }
            scriptPanel={
              <ScriptPanel
                fullScript={fullScript}
                scriptSourceLabel={scriptSourceLabel}
                scriptView={canvasUi.scriptView}
                onScriptViewChange={(scriptView) => onPatchCanvasUi({ scriptView })}
                scriptMap={graph.scriptMap}
                activeShotIndex={activeShotIndex}
                playheadSec={playheadSec}
                alignLoading={alignLoading}
                onSelectSegment={handleSelectSegment}
                onAlignScript={onAlignScript}
              />
            }
          />
        </EditLibraryPanel>

        <main className="nle-player min-w-0 flex-1 overflow-hidden">
          <PreviewPanel
            playerTitle="播放器"
            finalEditVideoUrl={state.finalEditVideoUrl}
            editRendering={state.editRendering}
            renderProgress={renderProgress}
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
                  ? (patchTr) => onTransitionChange(activeClip.id, patchTr)
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
          onSyncAssets={onSyncAssets}
          zoom={timelineZoom}
          onZoom={setTimelineZoom}
        />
        <div className="min-h-0 flex-1">
          <MultiTrackTimeline
            timeline={graph.timeline}
            sections={sections}
            activeClipId={activeClipId}
            playheadSec={playheadSec}
            dragIdx={dragIdx}
            onDragIdx={setDragIdx}
            onReorder={handleReorder}
            onDurationChange={handleDurationChange}
            onSelectClip={handleSelectClip}
            onSeek={setPlayheadSec}
            pxScale={timelineZoom}
            hideHeader
          />
        </div>
      </div>
    </div>
  );
}
