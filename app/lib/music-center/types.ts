/**
 * AI Cut 音乐中心（Music Center）
 *
 * DeepSeek Music Agent 负责推荐；Music Center 负责 BGM 管理、时间轴、Ducking、导出。
 * 不参与剪辑决策，最终交付 OpenCut。
 */

import type { TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";
import type { PacingProfile } from "@/app/lib/auto-edit/types";

export type MusicStyleTemplate =
  | "documentary"
  | "viral"
  | "cinematic"
  | "ambient"
  | "epic"
  | "lofi"
  | "custom";

export type SfxSuggestion = {
  label: string;
  atSec: number;
  rationale: string;
};

export type ClimaxPoint = {
  sec: number;
  label: string;
};

export type BeatMarker = {
  sec: number;
  strength: number;
};

export type VolumeStrategy = {
  baseVolume: number;
  duckUnderVoice: boolean;
  duckAmount: number;
  fadeInSec: number;
  fadeOutSec: number;
  duckSegments: { startSec: number; endSec: number; volume: number }[];
};

/** 导演下发的音乐任务 */
export type MusicDirectorTask = {
  id: string;
  durationSec: number;
  pacingProfile?: PacingProfile;
  topic?: string;
  script?: string;
  optimizeWithAi?: boolean;
  bgmUrl?: string;
  bgmFilename?: string;
  template?: MusicStyleTemplate;
  bpm?: number;
  baseVolume?: number;
  duckUnderVoice?: boolean;
  duckAmount?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  beatSync?: boolean;
  loop?: boolean;
  voiceClips?: { startSec: number; durationSec: number }[];
  videoClips?: { id: string; startSec: number; durationSec: number }[];
};

/** DeepSeek Music Agent 输出 */
export type MusicPlan = {
  bgmFilename: string;
  bgmUrl: string;
  bgmLabel: string;
  style: MusicStyleTemplate;
  rationale: string[];
  bpm?: number;
  climaxPoints?: ClimaxPoint[];
  beatMarkers?: BeatMarker[];
  volumeStrategy: VolumeStrategy;
  sfxSuggestions?: SfxSuggestion[];
};

export type MusicCenterExports = {
  json: string;
};

export type OpenCutMusicPayload = {
  musicTracks: {
    id: string;
    startSec: number;
    durationSec: number;
    assetId: string;
    label: string;
    volume: number;
  }[];
  commands: import("@/app/lib/opencut/commands").OpenCutCommand[];
};

export type MusicCenterResult = {
  taskId: string;
  status: "success" | "failed" | "cached";
  music: TimelineClip[];
  mediaRefId: string;
  plan?: MusicPlan;
  exports: MusicCenterExports;
  openCut: OpenCutMusicPayload;
  cost?: number;
  error?: string;
};

export type MusicCenterLogEntry = {
  taskId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "success" | "failed" | "cached";
  bgmLabel?: string;
  cost?: number;
  error?: string;
};

export type BgmLibraryEntry = {
  filename: string;
  url: string;
  kind: "bgm" | "sfx";
};
