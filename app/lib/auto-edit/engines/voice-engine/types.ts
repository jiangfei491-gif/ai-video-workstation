import type { VoiceProviderId } from "../types";

export type VoiceSynthesizeParams = {
  text: string;
  shotIndex: number;
  voiceId?: string;
  outputPath: string;
};

export type VoiceSynthesizeResult = {
  filepath: string;
  durationSec: number;
  provider: VoiceProviderId;
};

export type VoiceProvider = {
  id: VoiceProviderId;
  label: string;
  available: () => boolean;
  synthesize: (params: VoiceSynthesizeParams) => Promise<VoiceSynthesizeResult>;
};

export const VOICE_PROVIDER_LABELS: Record<VoiceProviderId, string> = {
  "edge-tts": "Edge TTS（本地）",
  "openai-audio": "OpenAI Audio",
  elevenlabs: "ElevenLabs",
  "google-tts": "Google TTS",
  "azure-tts": "Azure TTS",
  local: "本地 TTS",
};
