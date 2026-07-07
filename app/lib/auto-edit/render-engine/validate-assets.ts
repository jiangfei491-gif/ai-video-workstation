import type { EditRenderMode, EditSequence } from "../types";
import { resolveMediaFilePath } from "../resolve-media";
import type { AssetValidationResult, EffectiveClipKind } from "./types";

export function resolveEffectiveKind(
  sourceKind: EditSequence["clips"][string]["sourceKind"],
  mode: EditRenderMode
): EffectiveClipKind {
  if (sourceKind === "missing") return "skip";
  if (mode === "image") {
    return sourceKind === "video" || sourceKind === "image" ? "image" : "skip";
  }
  if (mode === "video") {
    return sourceKind === "video" ? "video" : "skip";
  }
  if (sourceKind === "video") return "video";
  if (sourceKind === "image") return "image";
  return "skip";
}

/** 验证素材是否齐全、本地文件是否可读 */
export function validateRenderAssets(
  sequence: EditSequence,
  mode: EditRenderMode
): AssetValidationResult {
  const issues: AssetValidationResult["issues"] = [];
  const warnings: string[] = [];
  let readyCount = 0;

  for (const key of sequence.playOrder) {
    const clip = sequence.clips[key];
    if (!clip) {
      issues.push({ key, shotIndex: -1, reason: "clip 不存在" });
      continue;
    }
    if (clip.durationSec <= 0) {
      issues.push({ key, shotIndex: clip.shotIndex, reason: "时长为 0" });
      continue;
    }

    const effective = resolveEffectiveKind(clip.sourceKind, mode);
    if (effective === "skip") {
      if (clip.sourceKind === "missing") {
        issues.push({ key, shotIndex: clip.shotIndex, reason: "缺素材" });
      } else if (mode === "video" && clip.sourceKind === "image") {
        issues.push({ key, shotIndex: clip.shotIndex, reason: "纯视频模式跳过图片" });
      } else {
        issues.push({ key, shotIndex: clip.shotIndex, reason: "当前成片模式不可用" });
      }
      continue;
    }

    const inputPath = resolveMediaFilePath(clip.mediaUrl);
    if (!inputPath) {
      issues.push({ key, shotIndex: clip.shotIndex, reason: "媒体文件路径无效" });
      continue;
    }

    readyCount++;
  }

  if (readyCount > 0 && issues.length > 0) {
    warnings.push(`共 ${issues.length} 个镜头将被跳过，继续渲染 ${readyCount} 个片段`);
  }

  return {
    canRender: readyCount > 0,
    readyCount,
    issues,
    warnings,
  };
}

export function resolveSegmentInput(
  clip: EditSequence["clips"][string],
  mode: EditRenderMode
): { effectiveKind: EffectiveClipKind; inputPath: string | null; skipReason?: string } {
  if (!clip || clip.durationSec <= 0) {
    return { effectiveKind: "skip", inputPath: null, skipReason: "时长无效" };
  }

  const effectiveKind = resolveEffectiveKind(clip.sourceKind, mode);
  if (effectiveKind === "skip") {
    let skipReason = "缺素材";
    if (clip.sourceKind !== "missing" && mode === "video") skipReason = "纯视频模式跳过图片";
    else if (clip.sourceKind === "missing") skipReason = "缺素材";
    else skipReason = "当前成片模式不可用";
    return { effectiveKind, inputPath: null, skipReason };
  }

  const inputPath = resolveMediaFilePath(clip.mediaUrl);
  if (!inputPath) {
    return { effectiveKind: "skip", inputPath: null, skipReason: "媒体文件路径无效" };
  }

  return { effectiveKind, inputPath };
}
