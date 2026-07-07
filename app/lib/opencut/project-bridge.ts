/**
 * OpenCut 工程桥接层
 *
 * AI Agent 不操作 OpenCut UI，只读写工程数据。
 * 当前 EditGraph 作为 interchange format；接入 OpenCut SDK 后在此转换。
 */

import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";

/** OpenCut 可消费的工程描述（与 EditGraph 对齐，待替换为 OpenCut 原生类型） */
export type OpenCutProjectPayload = {
  version: 1;
  name: string;
  fps: number;
  aspectRatio: string;
  durationSec: number;
  /** 画面轨：startSec + mediaPath + durationSec */
  videoClips: {
    id: string;
    label: string;
    startSec: number;
    durationSec: number;
    mediaPath: string | null;
    shotIndex?: number;
  }[];
  voiceTracks: { id: string; startSec: number; durationSec: number; mediaPath: string | null }[];
  musicTracks: { id: string; startSec: number; durationSec: number; mediaPath: string | null }[];
  subtitleTracks: { id: string; startSec: number; durationSec: number; text: string }[];
  transitions: {
    afterClipId: string;
    type: string;
    durationMs: number;
  }[];
};

export type OpenCutExportRequest = {
  project: OpenCutProjectPayload;
  outputPath: string;
  format: "mp4" | "mov" | "prores";
};

function mediaPathFromRef(graph: EditGraph, mediaRefId?: string): string | null {
  if (!mediaRefId) return null;
  const item = graph.mediaPool.find((p) => p.id === mediaRefId);
  return item?.url ?? null;
}

/** Edit Graph → OpenCut 工程（Agent 写入剪辑器的标准入口） */
export function editGraphToOpenCutProject(
  graph: EditGraph,
  name = "project"
): OpenCutProjectPayload {
  const { timeline } = graph;
  return {
    version: 1,
    name,
    fps: timeline.fps,
    aspectRatio: timeline.aspectRatio,
    durationSec: timeline.durationSec,
    videoClips: timeline.video.map((c) => ({
      id: c.id,
      label: c.label,
      startSec: c.startSec,
      durationSec: c.durationSec,
      mediaPath: mediaPathFromRef(graph, c.mediaRefId),
      shotIndex: c.video?.shotIndex,
    })),
    voiceTracks: timeline.voice.map((c) => ({
      id: c.id,
      startSec: c.startSec,
      durationSec: c.durationSec,
      mediaPath: mediaPathFromRef(graph, c.mediaRefId),
    })),
    musicTracks: timeline.music.map((c) => ({
      id: c.id,
      startSec: c.startSec,
      durationSec: c.durationSec,
      mediaPath: mediaPathFromRef(graph, c.mediaRefId),
    })),
    subtitleTracks: timeline.subtitle.map((c) => ({
      id: c.id,
      startSec: c.startSec,
      durationSec: c.durationSec,
      text: c.subtitle?.text ?? c.label,
    })),
    transitions: timeline.transitions.map((t) => ({
      afterClipId: t.afterClipId,
      type: t.type,
      durationMs: t.durationMs,
    })),
  };
}

/**
 * 触发 OpenCut 导出（占位：当前走 FFmpeg Render Engine）
 * 接入 OpenCut 后替换为 SDK 调用。
 */
export async function requestOpenCutExport(
  _request: OpenCutExportRequest
): Promise<{ ok: boolean; message: string }> {
  return {
    ok: false,
    message: "OpenCut SDK 尚未接入；请使用 Render Engine /api/auto-edit/render",
  };
}
