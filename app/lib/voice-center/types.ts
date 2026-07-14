/**
 * AI Cut 配音中心（Voice Center）
 *
 * 只执行，不决策。所有配音要求来自 AI 导演（VoiceDirectorTask）。
 */

export type VoiceCenterProviderId =
  | "f5-tts"
  | "fish-speech"
  | "cosyvoice"
  | "elevenlabs"
  | "openai-audio"
  | "edge-tts";

export type VoiceCategory =
  | "male"
  | "female"
  | "child"
  | "elder"
  | "narrator"
  | "news"
  | "film"
  | "documentary"
  | "anime"
  | "host";

export type VoiceQualityHint = "standard" | "high" | "ultra";
export type VoiceBudgetHint = "low" | "balanced" | "high";

/** AI 导演下发的配音任务（含全部决策，中心不做推断） */
export type VoiceDirectorTask = {
  id: string;
  text: string;
  language?: string;
  /** 指定音色 id */
  voiceId?: string;
  voiceCategory?: VoiceCategory;
  emotion?: string;
  tone?: string;
  quality?: VoiceQualityHint;
  budget?: VoiceBudgetHint;
  speed?: number;
  pitch?: number;
  volume?: number;
  pauseMs?: number;
  accent?: string;
  /** 显式指定引擎（导演已选好则跳过自动选择） */
  provider?: VoiceCenterProviderId;
  /** 成片渲染导出：优先 edge-tts / ElevenLabs，减少不可用本地引擎阻塞 */
  renderExport?: boolean;
  /** 用户开启「超高质量」时允许云端 ElevenLabs */
  ultraQuality?: boolean;
  preferLocal?: boolean;
  roleId?: string;
  shotIndex?: number;
  outputPath?: string;
};

export type WordTimestamp = {
  word: string;
  startSec: number;
  endSec: number;
};

export type SentenceTimestamp = {
  text: string;
  startSec: number;
  endSec: number;
};

export type VoiceCenterAudio = {
  filepath: string;
  url: string;
  relativePath: string;
};

export type VoiceCenterResult = {
  taskId: string;
  status: "success" | "failed" | "cached";
  audio: VoiceCenterAudio;
  duration: number;
  provider: VoiceCenterProviderId;
  voice: string;
  sentenceTimestamp: SentenceTimestamp[];
  wordTimestamp: WordTimestamp[];
  cost?: number;
  cached?: boolean;
  error?: string;
};

export type ProviderHealth = {
  ok: boolean;
  latencyMs?: number;
  message?: string;
  gpuUsage?: number;
  cpuUsage?: number;
  vramMb?: number;
  memoryMb?: number;
};

export type VoiceProviderConfig = {
  id: VoiceCenterProviderId;
  label: string;
  kind: "local" | "cloud";
  enabled: boolean;
  priority: number;
  isDefault?: boolean;
  envKeys?: string[];
  endpointEnv?: string;
};

export type VoiceCenterLogEntry = {
  taskId: string;
  provider: VoiceCenterProviderId;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  cost?: number;
  status: "success" | "failed" | "cached";
  error?: string;
};
