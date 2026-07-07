import type { VoiceProviderId } from "../types";
import type { VoiceProvider } from "./types";
import { edgeTtsProvider } from "./providers/edge-tts";
import { openAiTtsProvider } from "./providers/openai-tts";
import { elevenLabsTtsProvider } from "./providers/elevenlabs";

function stubProvider(id: VoiceProviderId, label: string, envKey: string): VoiceProvider {
  return {
    id,
    label,
    available: () => Boolean(process.env[envKey]),
    async synthesize() {
      throw new Error(`${label} 尚未配置，请设置 ${envKey}`);
    },
  };
}

const PROVIDERS: VoiceProvider[] = [
  edgeTtsProvider,
  openAiTtsProvider,
  elevenLabsTtsProvider,
  stubProvider("google-tts", "Google TTS", "GOOGLE_TTS_API_KEY"),
  stubProvider("azure-tts", "Azure TTS", "AZURE_SPEECH_KEY"),
  stubProvider("local", "本地 TTS", "LOCAL_TTS_ENDPOINT"),
];

export function getVoiceProvider(id: VoiceProviderId = "edge-tts"): VoiceProvider {
  return PROVIDERS.find((p) => p.id === id) ?? edgeTtsProvider;
}

export function listVoiceProviders(): VoiceProvider[] {
  return PROVIDERS;
}
