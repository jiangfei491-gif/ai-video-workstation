import type { SubtitleEngineOptions, SubtitleLanguage, VoiceProviderId } from "./types";
import type { TransitionType } from "../types";

export type EditEngineSettings = {
  subtitle: SubtitleEngineOptions & {
    highlightKeywords: string[];
    burnAss: boolean;
  };
  voice: {
    provider: VoiceProviderId;
    voiceId: string;
  };
  music: {
    fadeInSec: number;
    fadeOutSec: number;
    loop: boolean;
    duckUnderVoice: boolean;
    /** 0–1，口播时 BGM 压低强度 */
    duckAmount: number;
    autoRecommend: boolean;
  };
  transition: {
    defaultType: TransitionType;
    defaultDurationMs: number;
  };
  effect: {
    enabled: boolean;
    filmGrain: boolean;
    sharpen: boolean;
    vignette: boolean;
  };
  audio: {
    denoise: boolean;
    loudnorm: boolean;
    compress: boolean;
  };
  localization: {
    enabled: boolean;
    targetLanguages: SubtitleLanguage[];
    translateSubtitles: boolean;
    multilingualVoice: boolean;
  };
  export: {
    format: "mp4" | "mov";
    includeSrt: boolean;
    includeAss: boolean;
    prores: boolean;
  };
  storyGraph: {
    bpm: number;
  };
};

export const DEFAULT_EDIT_ENGINE_SETTINGS: EditEngineSettings = {
  subtitle: {
    templateId: "default",
    primaryLang: "zh",
    maxCharsPerLine: 18,
    maxLines: 2,
    highlightKeywords: [],
    burnAss: true,
  },
  voice: {
    // edge-tts：免费、云端、任何机器可用、中文好。本地重型 TTS(f5/fish/cosyvoice)在 Intel Mac 跑不动会哑音。
    provider: "edge-tts",
    voiceId: "zh-CN-XiaoxiaoNeural",
  },
  music: {
    fadeInSec: 1.5,
    fadeOutSec: 2,
    loop: true,
    duckUnderVoice: true,
    duckAmount: 0.55,
    autoRecommend: false,
  },
  transition: {
    defaultType: "crossfade",
    defaultDurationMs: 400,
  },
  effect: {
    enabled: false,
    filmGrain: false,
    sharpen: false,
    vignette: false,
  },
  audio: {
    denoise: true,
    loudnorm: true,
    compress: false,
  },
  localization: {
    enabled: false,
    targetLanguages: [],
    translateSubtitles: true,
    multilingualVoice: false,
  },
  export: {
    format: "mp4",
    includeSrt: true,
    includeAss: false,
    prores: false,
  },
  storyGraph: {
    bpm: 120,
  },
};

export function mergeEditEngineSettings(
  partial?: Partial<EditEngineSettings> | null
): EditEngineSettings {
  if (!partial) return { ...DEFAULT_EDIT_ENGINE_SETTINGS };
  return {
    ...DEFAULT_EDIT_ENGINE_SETTINGS,
    ...partial,
    subtitle: { ...DEFAULT_EDIT_ENGINE_SETTINGS.subtitle, ...partial.subtitle },
    voice: { ...DEFAULT_EDIT_ENGINE_SETTINGS.voice, ...partial.voice },
    music: { ...DEFAULT_EDIT_ENGINE_SETTINGS.music, ...partial.music },
    transition: { ...DEFAULT_EDIT_ENGINE_SETTINGS.transition, ...partial.transition },
    effect: { ...DEFAULT_EDIT_ENGINE_SETTINGS.effect, ...partial.effect },
    audio: { ...DEFAULT_EDIT_ENGINE_SETTINGS.audio, ...partial.audio },
    localization: { ...DEFAULT_EDIT_ENGINE_SETTINGS.localization, ...partial.localization },
    export: { ...DEFAULT_EDIT_ENGINE_SETTINGS.export, ...partial.export },
    storyGraph: { ...DEFAULT_EDIT_ENGINE_SETTINGS.storyGraph, ...partial.storyGraph },
  };
}
