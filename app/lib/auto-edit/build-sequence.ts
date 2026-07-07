import type { BuildEditInput, ClipSpec, EditSequence, PacingProfile, TransitionType } from "./types";
import { clipLabel, shotKey } from "./keys";

function inferSectionId(
  key: string,
  pos: { x: number; y: number } | undefined,
  sections: BuildEditInput["sections"]
): string | undefined {
  if (!pos) return undefined;
  for (const s of sections) {
    if (
      pos.x >= s.x &&
      pos.x <= s.x + s.w &&
      pos.y >= s.y &&
      pos.y <= s.y + s.h
    ) {
      return s.id;
    }
  }
  return undefined;
}

/**
 * 解析 clip 媒体（档位 0：IMAGE 稳定身份链优先，替代纯 shotIndex 取图）。
 * mediaUri 解析优先级：
 *   1) 视频(video 模式)：batchResults[shotIndex].videoUrl（保留，避免破坏 t2v）
 *   2) IMAGE 稳定身份：imageTaskId（或 shotId→shotToImageTaskMap 反查）→ imageTaskFrames[imageTaskId]
 *   3) legacy 兼容 fallback：shotFrames[shotIndex]
 *   4) 兜底：batchResults[shotIndex].firstFrameUrl
 * shotFrames[shotIndex] 仅作兼容 fallback，不再是 Narrative 主链的主身份解析。
 */
export function resolveClipMedia(params: {
  shotIndex: number;
  shotId?: string;
  imageTaskId?: string;
  input: Pick<
    BuildEditInput,
    "batchResults" | "shotFrames" | "imageTaskFrames" | "shotToImageTaskMap"
  >;
}): Pick<ClipSpec, "sourceKind" | "mediaUrl"> {
  const { shotIndex, shotId, imageTaskId, input } = params;
  const batch = input.batchResults[shotIndex];

  // 1) 真实生成视频优先（video 模式；IMAGE 模式此项为空，自然跳过）
  if (batch?.status === "success" && batch.videoUrl) {
    return { sourceKind: "video", mediaUrl: batch.videoUrl };
  }

  // 2) IMAGE 稳定身份链：imageTaskId → imageTaskFrames（第一/第二优先合一）
  const taskId = imageTaskId ?? (shotId ? input.shotToImageTaskMap?.[shotId] : undefined);
  const taskFrame = taskId ? input.imageTaskFrames?.[taskId] : undefined;
  if (taskFrame) return { sourceKind: "image", mediaUrl: taskFrame };

  // 3) legacy 兼容 fallback：shotFrames[shotIndex]
  const legacyFrame = input.shotFrames[shotIndex];
  if (legacyFrame) return { sourceKind: "image", mediaUrl: legacyFrame };

  // 4) 兜底：批量结果首帧
  if (batch?.firstFrameUrl) return { sourceKind: "image", mediaUrl: batch.firstFrameUrl };
  return { sourceKind: "missing" };
}

function resolveClipSource(
  sb: BuildEditInput["storyboard"][number],
  input: BuildEditInput
): Pick<ClipSpec, "sourceKind" | "mediaUrl"> {
  return resolveClipMedia({
    shotIndex: sb.shotIndex,
    shotId: sb.shotId,
    imageTaskId: sb.imageTaskId,
    input,
  });
}

/** 从工作台状态构建默认 EditSequence（playOrder = 分镜 index 顺序） */
export function buildDefaultEditSequence(
  input: BuildEditInput,
  pacingProfile: PacingProfile = "documentary",
  transitionDefaults?: { type: TransitionType; durationMs: number }
): EditSequence {
  const clips: Record<string, ClipSpec> = {};
  const playOrder: string[] = [];
  const castSet = new Set(input.castLinks.map((l) => l.shotIdx));

  for (const sb of input.storyboard) {
    const key = shotKey(sb.shotIndex);
    playOrder.push(key);
    const pos = input.shotPositions[key];
    const src = resolveClipSource(sb, input);
    clips[key] = {
      key,
      shotIndex: sb.shotIndex,
      label: clipLabel(sb.shotIndex, sb.action),
      ...src,
      durationSec: Math.max(1, sb.duration || 4),
      sectionId: inferSectionId(key, pos, input.sections),
      hasCast: castSet.has(sb.shotIndex),
      storyboardHint: [sb.action, sb.environment, sb.camera].filter(Boolean).join(" · "),
      // ── Narrative Shot 承接（Phase 1）：稳定身份 + 镜头语言透传 ──
      shotId: sb.shotId,
      beatId: sb.beatId,
      imageTaskId: sb.imageTaskId,
      camera: sb.camera || undefined,
      visualFocus: sb.visualFocus,
      shotPurpose: sb.shotPurpose,
      reaction: sb.reaction,
    };
  }

  const trType = transitionDefaults?.type ?? "cut";
  const trDur =
    trType === "cut" ? 0 : Math.max(0, transitionDefaults?.durationMs ?? 400);

  const transitions = [];
  for (let i = 0; i < playOrder.length - 1; i++) {
    transitions.push({
      fromKey: playOrder[i],
      toKey: playOrder[i + 1],
      type: trType,
      durationMs: trDur,
    });
  }

  const totalDurationSec = playOrder.reduce(
    (s, k) => s + (clips[k]?.durationSec ?? 0),
    0
  );

  return {
    playOrder,
    clips,
    transitions,
    pacingProfile,
    totalDurationSec,
    updatedAt: new Date().toISOString(),
  };
}

/** 叙事边约束：确保 to 在 from 之后（拓扑排序） */
export function applyNarrativeOrder(
  sequence: EditSequence,
  edges: { from: string; to: string }[]
): EditSequence {
  if (edges.length === 0) return sequence;
  const order = [...sequence.playOrder];
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) {
      const i = order.indexOf(e.from);
      const j = order.indexOf(e.to);
      if (i < 0 || j < 0) continue;
      if (i > j) {
        order.splice(i, 1);
        order.splice(j, 0, e.from);
        changed = true;
      }
    }
  }
  return rebuildTransitions({ ...sequence, playOrder: order });
}

export function rebuildTransitions(sequence: EditSequence): EditSequence {
  const transitions = [];
  for (let i = 0; i < sequence.playOrder.length - 1; i++) {
    const fromKey = sequence.playOrder[i];
    const toKey = sequence.playOrder[i + 1];
    const prev = sequence.transitions.find((t) => t.fromKey === fromKey && t.toKey === toKey);
    transitions.push(
      prev ?? { fromKey, toKey, type: "cut" as const, durationMs: 0 }
    );
  }
  const totalDurationSec = sequence.playOrder.reduce(
    (s, k) => s + (sequence.clips[k]?.durationSec ?? 0),
    0
  );
  return {
    ...sequence,
    transitions,
    totalDurationSec,
    updatedAt: new Date().toISOString(),
  };
}

export function reorderPlayOrder(
  sequence: EditSequence,
  fromIndex: number,
  toIndex: number
): EditSequence {
  const order = [...sequence.playOrder];
  if (fromIndex < 0 || fromIndex >= order.length || toIndex < 0 || toIndex >= order.length) {
    return sequence;
  }
  const [item] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, item);
  return rebuildTransitions({ ...sequence, playOrder: order });
}

export function updateClipDuration(
  sequence: EditSequence,
  key: string,
  durationSec: number
): EditSequence {
  const clip = sequence.clips[key];
  if (!clip) return sequence;
  return rebuildTransitions({
    ...sequence,
    clips: {
      ...sequence.clips,
      [key]: { ...clip, durationSec: Math.max(0.5, durationSec) },
    },
  });
}
