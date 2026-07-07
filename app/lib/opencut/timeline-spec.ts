/**
 * AI 导演输出的统一 Timeline JSON
 * OpenCut 剪辑引擎读取此结构加载工程（不经 UI 自动化）
 */

export type AiTimelineTransition = {
  afterSceneId: string;
  type: string;
  durationMs: number;
};

export type AiTimelineScene = {
  id: string;
  label: string;
  /** 素材 URL 或本地路径 */
  media: string | null;
  mediaKind: "image" | "video" | "missing";
  startSec: number;
  endSec: number;
  durationSec: number;
  subtitle: string | null;
  voiceMedia: string | null;
  /** 镜头运动 / 运镜描述（供 OpenCut 或渲染引擎消费） */
  cameraMotion: string | null;
  shotIndex?: number;
  transitionAfter?: AiTimelineTransition | null;
};

export type AiTimelineSpec = {
  version: 1;
  name: string;
  fps: number;
  aspectRatio: string;
  durationSec: number;
  scenes: AiTimelineScene[];
  voiceTrack: { startSec: number; endSec: number; media: string | null; label: string }[];
  subtitleTrack: { startSec: number; endSec: number; text: string }[];
  bgm: { media: string | null; volume: number; duckUnderVoice: boolean } | null;
  coverImage: string | null;
};
