import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export type StoryNodeKind = "character" | "location" | "prop" | "event" | "shot";

export type StoryGraphNode = {
  id: string;
  kind: StoryNodeKind;
  label: string;
  shotIndex?: number;
  meta?: Record<string, string>;
};

export type StoryGraphEdge = {
  id: string;
  from: string;
  to: string;
  /** narrative = 剧情关系（蓝线）；playback = 播放路径（橙线） */
  kind: "narrative" | "playback";
  label?: string;
};

export type StoryGraph = {
  nodes: StoryGraphNode[];
  edges: StoryGraphEdge[];
  updatedAt: string;
};

/** 从工作台构建 Story Graph（Phase 3） */
export function buildStoryGraphFromWorkbench(state: T2VWorkbenchState): StoryGraph {
  const nodes: StoryGraphNode[] = [];
  const edges: StoryGraphEdge[] = [];

  const director = state.director;
  if (director?.storyboard) {
    for (const sb of director.storyboard) {
      const idx = sb.sceneNumber - 1;
      nodes.push({
        id: `shot-${idx}`,
        kind: "shot",
        label: `镜 ${idx + 1}`,
        shotIndex: idx,
        meta: { action: sb.action, environment: sb.environment },
      });
      if (sb.character?.trim()) {
        const cid = `char-${sb.character.slice(0, 12)}`;
        if (!nodes.find((n) => n.id === cid)) {
          nodes.push({ id: cid, kind: "character", label: sb.character });
        }
        edges.push({
          id: `e-${cid}-shot-${idx}`,
          from: cid,
          to: `shot-${idx}`,
          kind: "narrative",
        });
      }
      if (sb.environment?.trim()) {
        const lid = `loc-${sb.environment.slice(0, 12)}`;
        if (!nodes.find((n) => n.id === lid)) {
          nodes.push({ id: lid, kind: "location", label: sb.environment });
        }
        edges.push({
          id: `e-${lid}-shot-${idx}`,
          from: lid,
          to: `shot-${idx}`,
          kind: "narrative",
        });
      }
    }
  }

  for (const propId of state.propIds ?? []) {
    const pid = `prop-${propId.slice(0, 12)}`;
    if (!nodes.find((n) => n.id === pid)) {
      nodes.push({ id: pid, kind: "prop", label: `道具 ${propId.slice(0, 8)}` });
    }
  }

  for (const e of state.canvasEdges) {
    edges.push({
      id: e.id,
      from: e.from,
      to: e.to,
      kind: "narrative",
    });
  }

  const playOrder = state.editGraph?.timeline.video ?? [];
  for (let i = 0; i < playOrder.length - 1; i++) {
    const a = playOrder[i];
    const b = playOrder[i + 1];
    const fromKey = a.video?.shotIndex !== undefined ? `shot-${a.video.shotIndex}` : a.sourceKey;
    const toKey = b.video?.shotIndex !== undefined ? `shot-${b.video.shotIndex}` : b.sourceKey;
    edges.push({
      id: `play-${i}`,
      from: fromKey,
      to: toKey,
      kind: "playback",
    });
  }

  return { nodes, edges, updatedAt: new Date().toISOString() };
}

export type ContinuityIssue = {
  shotIndex: number;
  type: "wardrobe" | "lighting" | "direction" | "prop" | "character";
  message: string;
  severity: "warn" | "error";
};

/** 规则型连续性检查（Phase 3） */
export function checkContinuity(state: T2VWorkbenchState): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  const sb = state.director?.storyboard ?? [];
  for (let i = 1; i < sb.length; i++) {
    const prev = sb[i - 1];
    const cur = sb[i];
    if (prev.character !== cur.character && prev.character && cur.character) {
      issues.push({
        shotIndex: i,
        type: "character",
        message: `镜 ${i + 1} 角色从「${prev.character}」变为「${cur.character}」`,
        severity: "warn",
      });
    }
    if (prev.environment !== cur.environment && prev.environment && cur.environment) {
      issues.push({
        shotIndex: i,
        type: "lighting",
        message: `镜 ${i + 1} 场景从「${prev.environment}」切换至「${cur.environment}」`,
        severity: "warn",
      });
    }
  }
  for (const key of Object.keys(state.batchResults)) {
    const idx = Number(key);
    const r = state.batchResults[idx];
    if (r?.status === "failed") {
      issues.push({
        shotIndex: idx,
        type: "prop",
        message: `镜 ${idx + 1} 视频生成失败，需补镜`,
        severity: "error",
      });
    }
  }
  return issues;
}

export type BeatSyncSuggestion = {
  transitionAfterClipId: string;
  beatSec: number;
  reason: string;
};

/** 简易卡点建议：按 BPM 均匀切分（Phase 3） */
export function suggestBeatSync(
  bpm: number,
  clipStarts: { clipId: string; startSec: number }[]
): BeatSyncSuggestion[] {
  if (bpm <= 0 || clipStarts.length === 0) return [];
  const beatInterval = 60 / bpm;
  const out: BeatSyncSuggestion[] = [];
  for (const c of clipStarts) {
    const nearestBeat = Math.round(c.startSec / beatInterval) * beatInterval;
    if (Math.abs(nearestBeat - c.startSec) < 0.15) {
      out.push({
        transitionAfterClipId: c.clipId,
        beatSec: nearestBeat,
        reason: `接近 ${bpm} BPM 鼓点（${beatInterval.toFixed(2)}s 间隔）`,
      });
    }
  }
  return out;
}

export type FillShotSuggestion = {
  shotIndex: number;
  durationSec: number;
  prompt: string;
  reason: string;
};

/** 自动补镜建议（Phase 3） */
export function suggestFillShots(state: T2VWorkbenchState): FillShotSuggestion[] {
  const out: FillShotSuggestion[] = [];
  const sb = state.director?.storyboard ?? [];
  for (let i = 0; i < sb.length; i++) {
    const hasVideo = state.batchResults[i]?.status === "success";
    const hasFrame = Boolean(state.shotFrames[i]);
    if (!hasVideo && !hasFrame) {
      out.push({
        shotIndex: i,
        durationSec: state.shotDurationSec,
        prompt: `${sb[i].action} · ${sb[i].environment}`,
        reason: "缺素材，建议生成建立镜头",
      });
    }
  }
  return out;
}

export { applyBeatSyncToTimeline } from "./beat-sync";
