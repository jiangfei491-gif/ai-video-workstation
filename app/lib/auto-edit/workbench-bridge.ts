import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import type { BuildEditInput, EditSequence } from "./types";
import { shotKey } from "./keys";
import { applyNarrativeOrder, buildDefaultEditSequence, resolveClipMedia } from "./build-sequence";
import {
  loadCachedProjectScript,
  pickLongestScript,
} from "@/app/lib/workbench-persist/script-cache";

/** 项目完整脚本文本：优先最长稿（素材库 / 编导 / 独立缓存） */
export function resolveProjectScript(state: T2VWorkbenchState): string {
  const cached = typeof window !== "undefined" ? loadCachedProjectScript()?.text : undefined;
  return pickLongestScript(state.sourceScript, state.director?.script, cached);
}

/** 脚本来源说明，用于剪辑中心展示 */
export function resolveProjectScriptLabel(state: T2VWorkbenchState): string | null {
  const cached =
    typeof window !== "undefined" ? loadCachedProjectScript()?.label : undefined;
  if (state.sourceScript?.trim() || cached) {
    return state.sourceScriptLabel?.trim() || cached || "素材库脚本";
  }
  if (state.director?.script?.trim()) return "编导生成脚本";
  return null;
}

export function buildEditInputFromWorkbench(state: T2VWorkbenchState): BuildEditInput | null {
  const director = state.director;
  if (!director?.storyboard?.length) return null;

  const shotToImageTask = state.imageTaskMapping?.shotToImageTaskMap ?? {};
  const storyboard = director.storyboard.map((sb, shotIndex) => ({
    shotIndex,
    duration:
      state.pipelineMode === "t2i"
        ? (Number.isFinite(sb.duration) && sb.duration > 0
            ? sb.duration
            : state.shotDurationSec)
        : (sb.duration ?? state.shotDurationSec),
    action: sb.action ?? "",
    environment: sb.environment ?? "",
    camera: sb.camera ?? "",
    narration: sb.narration ?? "",
    // ── Narrative Shot 承接（Phase 1）：稳定身份 + 镜头语言透传 ──
    shotId: sb.shotId,
    beatId: sb.beatId,
    imageTaskId: sb.shotId ? shotToImageTask[sb.shotId] : undefined,
    visualFocus: sb.visualFocus,
    shotPurpose: sb.shotPurpose,
    reaction: sb.reaction,
  }));

  const narrativeEdges = state.canvasEdges
    .filter((e) => e.from.startsWith("shot-") && e.to.startsWith("shot-"))
    .map((e) => ({ from: e.from, to: e.to }));

  return {
    topic: state.topic || director.title,
    script: resolveProjectScript(state),
    storyboard,
    sections: state.canvasSections,
    shotPositions: state.canvasPositions,
    narrativeEdges,
    castLinks: state.canvasLinks,
    shotFrames: state.shotFrames,
    batchResults: state.batchResults,
    // 档位 0：IMAGE 稳定身份取图（imageTaskId → 资产 url）
    imageTaskFrames: state.imageTaskFrames ?? {},
    shotToImageTaskMap: shotToImageTask,
    fps: state.fps,
    aspectRatio: state.aspectRatio,
  };
}

export function pacingFromStyle(state: T2VWorkbenchState): "documentary" | "viral" | "cinematic" {
  const vt = state.projectBible?.videoType ?? "";
  if (/爆款|短视频|viral/i.test(vt)) return "viral";
  if (/电影|cinematic|film/i.test(vt)) return "cinematic";
  if (
    state.stylePresetId === "bbc_documentary" ||
    state.stylePresetId === "natgeo" ||
    state.stylePresetId === "news_report"
  ) {
    return "documentary";
  }
  if (state.stylePresetId === "cinematic_film" || state.stylePresetId === "netflix_drama") {
    return "cinematic";
  }
  return "documentary";
}

export function syncClipAssetsFromWorkbench(
  sequence: import("./types").EditSequence,
  input: BuildEditInput
): import("./types").EditSequence {
  const clips = { ...sequence.clips };
  for (const key of sequence.playOrder) {
    const clip = clips[key];
    if (!clip) continue;
    // 档位 0：走稳定身份链取图（imageTaskId 优先，shotFrames[shotIndex] 仅兼容 fallback）
    const { sourceKind, mediaUrl } = resolveClipMedia({
      shotIndex: clip.shotIndex,
      shotId: clip.shotId,
      imageTaskId: clip.imageTaskId,
      input,
    });
    clips[key] = { ...clip, sourceKind, mediaUrl };
  }
  return { ...sequence, clips, updatedAt: new Date().toISOString() };
}

/** 剪辑序列素材是否与当前工作台不一致 */
export function editSequenceAssetsDiffer(before: EditSequence, after: EditSequence): boolean {
  for (const key of before.playOrder) {
    const a = before.clips[key];
    const b = after.clips[key];
    if (a?.sourceKind !== b?.sourceKind || a?.mediaUrl !== b?.mediaUrl) return true;
  }
  return false;
}

/** 初始化或刷新剪辑序列，并从 shotFrames / batchResults 同步素材 */
export function refreshEditSequenceFromWorkbench(state: T2VWorkbenchState): EditSequence | null {
  const input = buildEditInputFromWorkbench(state);
  if (!input) return null;

  let seq = state.editSequence;
  if (!seq?.playOrder?.length) {
    seq = buildDefaultEditSequence(input, pacingFromStyle(state));
    seq = applyNarrativeOrder(seq, input.narrativeEdges);
  }
  return syncClipAssetsFromWorkbench(seq, input);
}

export function shotKeysInPlayOrder(state: T2VWorkbenchState): string[] {
  return state.editSequence?.playOrder ?? [];
}

export function playOrderIndex(state: T2VWorkbenchState, shotIndex: number): number {
  const key = shotKey(shotIndex);
  const order = state.editSequence?.playOrder ?? [];
  const idx = order.indexOf(key);
  return idx >= 0 ? idx + 1 : shotIndex + 1;
}
