import type { EditRenderMode, EditSequence } from "../types";
import { aspectToOutputSize } from "../ffmpeg/aspect";
import type { RenderTimeline } from "./types";
import { resolveSegmentInput } from "./validate-assets";
import { resolveShotMotion } from "./shot-motion-resolver";

/** 根据 EditPlan / EditSequence 计算成片时间轴 */
export function buildRenderTimeline(
  sequence: EditSequence,
  mode: EditRenderMode,
  aspectRatio: string,
  fps: number
): RenderTimeline {
  const outputSize = aspectToOutputSize(aspectRatio);
  const segments: RenderTimeline["segments"] = [];
  const skippedKeys: string[] = [];
  let startSec = 0;

  for (const key of sequence.playOrder) {
    const clip = sequence.clips[key];
    if (!clip) continue;

    const { effectiveKind, inputPath, skipReason } = resolveSegmentInput(clip, mode);
    if (effectiveKind === "skip") {
      skippedKeys.push(key);
      segments.push({
        key,
        shotIndex: clip.shotIndex,
        label: clip.label,
        startSec,
        durationSec: clip.durationSec,
        effectiveKind,
        sourceKind: clip.sourceKind,
        inputPath: null,
        skipReason,
      });
      continue;
    }

    // ClipSpec → ShotMotionResolver（Phase 1）：无镜头语言时返回 null → 图片段回退旧 zoompan
    const motionSpec = resolveShotMotion({
      camera: clip.camera,
      visualFocus: clip.visualFocus,
      shotPurpose: clip.shotPurpose,
    });

    segments.push({
      key,
      shotIndex: clip.shotIndex,
      label: clip.label,
      startSec,
      durationSec: clip.durationSec,
      effectiveKind,
      sourceKind: clip.sourceKind,
      inputPath,
      motionSpec,
    });
    startSec += clip.durationSec;
  }

  return {
    segments,
    totalDurationSec: startSec,
    outputSize,
    fps,
    skippedKeys,
  };
}
