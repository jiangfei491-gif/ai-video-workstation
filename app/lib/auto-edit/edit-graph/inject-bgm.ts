import type { EditGraph } from "./types";

/** 若设置了 BGM URL，注入 music 轨与 mediaPool 条目 */
export function injectBgmIntoGraph(
  graph: EditGraph | null | undefined,
  bgmUrl: string | null | undefined,
  bgmVolume = 0.25
): EditGraph | null {
  if (!graph || !bgmUrl?.trim()) return graph ?? null;

  const pool = graph.mediaPool.filter((p) => p.id !== "bgm-main");
  pool.push({
    id: "bgm-main",
    kind: "music",
    label: "背景音乐",
    url: bgmUrl.trim(),
    origin: "upload",
    status: "ready",
  });

  const music =
    graph.timeline.music.length > 0
      ? graph.timeline.music
      : [
          {
            id: "bgm-0",
            track: "music" as const,
            startSec: 0,
            durationSec: graph.timeline.durationSec,
            sourceKey: "bgm-0",
            mediaRefId: "bgm-main",
            label: "背景音乐",
            audio: { volume: bgmVolume, duckUnderVoice: true },
          },
        ];

  return {
    ...graph,
    mediaPool: pool,
    timeline: { ...graph.timeline, music },
  };
}
