import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import type { EditPlan, EditSequence } from "../types";
import {
  applyNarrativeOrder,
  buildDefaultEditSequence,
} from "../build-sequence";
import { buildEditInputFromWorkbench, pacingFromStyle } from "../workbench-bridge";
import { currentStoryboardFingerprint } from "@/app/lib/ai-director/downstream-stale";
import { buildMediaPool, mergeMediaPool } from "./build-media-pool";
import { buildScriptMap, buildShotFirstScriptMap, attachTimelineToScriptMap } from "./build-script-map";
import {
  graphToSequence,
  rebuildDerivedTracks,
  sequenceToTimeline,
  syncClipSpecDurations,
} from "./timeline-bridge";
import { mergeEditEngineSettings } from "../engines/edit-settings";
import { alignTimelineAfterVoiceSynth } from "../audio/align-voice-subtitle";
import type { EditGraph, EditPlanVariant } from "./types";

function planToVariant(
  plan: EditPlan,
  input: NonNullable<ReturnType<typeof buildEditInputFromWorkbench>>,
  name: string
): EditPlanVariant {
  return {
    id: `plan-${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
    pacingProfile: plan.pacingProfile,
    timeline: sequenceToTimeline(plan, input),
    sequence: plan,
    rationale: {
      summary: plan.aiNotes ?? [],
      perShot: {},
      perTransition: {},
    },
    model: plan.model,
    usage: plan.usage,
  };
}

/** 从已有 editSequence / editPlan 迁移到 EditGraph v2 */
export function migrateToEditGraph(
  state: T2VWorkbenchState,
  sequence?: EditSequence | null
): EditGraph | null {
  const input = buildEditInputFromWorkbench(state);
  if (!input) return null;

  const pacing = pacingFromStyle(state);
  const settings = mergeEditEngineSettings(state.editEngineSettings);
  // editSequence 是派生镜像：若其镜数与当前分镜不符（分镜已变），视为过期，必须从分镜重建，
  // 否则旧的 30 镜镜像会一直压着新的 140 镜分镜（editSequence 旧覆盖路径 bug）。
  const persistedSeqInSync =
    state.editSequence != null &&
    state.editSequence.playOrder.length === input.storyboard.length;
  const seq =
    sequence ??
    (persistedSeqInSync ? state.editSequence : null) ??
    applyNarrativeOrder(
      buildDefaultEditSequence(input, pacing, {
        type: settings.transition.defaultType,
        durationMs: settings.transition.defaultDurationMs,
      }),
      input.narrativeEdges
    );

  const timeline = sequenceToTimeline(seq, input);
  const { timeline: withTracks, scriptMap } = rebuildDerivedTracks(timeline, input);

  const plans: EditPlanVariant[] = [];
  if (state.editPlan) {
    plans.push(planToVariant(state.editPlan, input, "已保存方案"));
  }

  return {
    version: 2,
    timeline: syncClipSpecDurations(withTracks),
    scriptMap: attachTimelineToScriptMap(scriptMap, withTracks.video),
    mediaPool: buildMediaPool(input),
    plans,
    activePlanId: plans[0]?.id ?? null,
    pacingProfile: seq.pacingProfile ?? pacing,
    updatedAt: new Date().toISOString(),
    storyboardFingerprint: currentStoryboardFingerprint(state),
  };
}

/** 刷新 EditGraph：同步素材池、video 轨素材、派生 voice/subtitle 轨 */
export function refreshEditGraphFromWorkbench(state: T2VWorkbenchState): EditGraph | null {
  const input = buildEditInputFromWorkbench(state);
  if (!input) return null;

  const pacing = pacingFromStyle(state);
  const fp = currentStoryboardFingerprint(state);
  let graph = state.editGraph;

  if (graph?.storyboardFingerprint && fp && graph.storyboardFingerprint !== fp) {
    graph = migrateToEditGraph(state);
    if (!graph) return null;
    return graph;
  }

  if (!graph || graph.version !== 2) {
    graph = migrateToEditGraph(state);
    if (!graph) return null;
  }

  const freshSeq = applyNarrativeOrder(
    buildDefaultEditSequence(input, graph.pacingProfile ?? pacing),
    input.narrativeEdges
  );

  const existingOrder = graph.timeline.video.map((c) => c.sourceKey);
  // 只有旧镜序与新分镜"镜数相同且 key 全覆盖"才沿用（保留用户手动重排）；
  // 镜数不同（分镜已变，如 30→140）必须用新分镜全序，否则会只保留旧的子集镜头。
  const useOrder =
    existingOrder.length === freshSeq.playOrder.length &&
    existingOrder.length > 0 &&
    existingOrder.every((k) => freshSeq.clips[k])
      ? existingOrder
      : freshSeq.playOrder;

  const clips = { ...freshSeq.clips };
  for (const key of useOrder) {
    const fresh = freshSeq.clips[key];
    const old = graph.timeline.video.find((c) => c.sourceKey === key);
    if (fresh && old) {
      clips[key] = {
        ...fresh,
        // 镜长以当前分镜规划为准（planNarrativeDuration），不保留旧 timeline 的固定 16s
        durationSec: fresh.durationSec,
      };
    }
  }

  const mergedSeq: EditSequence = {
    ...freshSeq,
    playOrder: useOrder,
    clips,
    pacingProfile: graph.pacingProfile,
  };

  const timeline = sequenceToTimeline(mergedSeq, input);
  const { timeline: withTracks, scriptMap } = rebuildDerivedTracks(timeline, input);
  const mediaPool = mergeMediaPool(buildMediaPool(input), graph.mediaPool);
  const hasSynthVoice = mediaPool.some(
    (p) => p.kind === "voice" && p.status === "ready" && Boolean(p.url)
  );
  const alignedTimeline = hasSynthVoice
    ? alignTimelineAfterVoiceSynth(withTracks, mediaPool)
    : withTracks;

  return {
    ...graph,
    timeline: syncClipSpecDurations(alignedTimeline),
    scriptMap,
    mediaPool,
    storyboardFingerprint: fp || graph.storyboardFingerprint,
    updatedAt: new Date().toISOString(),
  };
}

export function derivedTracksDiffer(before: EditGraph, after: EditGraph): boolean {
  return (
    before.timeline.voice.length !== after.timeline.voice.length ||
    before.timeline.subtitle.length !== after.timeline.subtitle.length
  );
}

export function editGraphAssetsDiffer(before: EditGraph, after: EditGraph): boolean {
  if (before.mediaPool.length !== after.mediaPool.length) return true;
  for (const item of after.mediaPool) {
    const prev = before.mediaPool.find((p) => p.id === item.id);
    if (!prev || prev.status !== item.status || prev.url !== item.url) return true;
  }
  return false;
}

export { graphToSequence };
