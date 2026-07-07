import type { VoiceProviderId } from "./types";

export type VoicePreset = { id: string; label: string };

/** 各 Provider 常用音色（客户端可安全引用） */
export const VOICE_PRESETS: Record<VoiceProviderId, VoicePreset[]> = {
  "edge-tts": [
    { id: "zh-CN-XiaoxiaoNeural", label: "晓晓（女）" },
    { id: "zh-CN-YunxiNeural", label: "云希（男）" },
    { id: "zh-CN-YunyangNeural", label: "云扬（男·新闻）" },
    { id: "zh-CN-XiaoyiNeural", label: "晓伊（女·童声）" },
  ],
  "openai-audio": [
    { id: "alloy", label: "Alloy" },
    { id: "nova", label: "Nova" },
    { id: "shimmer", label: "Shimmer" },
    { id: "echo", label: "Echo" },
    { id: "fable", label: "Fable" },
    { id: "onyx", label: "Onyx" },
  ],
  elevenlabs: [
    { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel（英）" },
    { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah（英）" },
    { id: "pNInz6obpgDQGcFmaJgB", label: "Adam（英）" },
    { id: "jBpfuIE2acCO8z3wKNLl", label: "Gigi（多语）" },
  ],
  "google-tts": [{ id: "zh-CN-Wavenet-A", label: "Wavenet A" }],
  "azure-tts": [{ id: "zh-CN-XiaoxiaoNeural", label: "晓晓" }],
  local: [{ id: "default", label: "默认" }],
};

export function defaultVoiceIdForProvider(provider: VoiceProviderId): string {
  return VOICE_PRESETS[provider][0]?.id ?? "";
}
