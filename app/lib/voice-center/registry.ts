import type { VoiceCenterProviderId, VoiceProviderConfig } from "./types";

/** 默认回退链：本地 → edge-tts（免费）→ ElevenLabs（edge 限流时的云端兜底） */
export const DEFAULT_LOCAL_CHAIN: VoiceCenterProviderId[] = [
  "f5-tts",
  "fish-speech",
  "cosyvoice",
  "edge-tts",
  "elevenlabs",
];

export const ULTRA_CLOUD_CHAIN: VoiceCenterProviderId[] = ["elevenlabs"];

const REGISTRY: VoiceProviderConfig[] = [
  {
    id: "f5-tts",
    label: "F5-TTS（本地默认）",
    kind: "local",
    enabled: true,
    priority: 100,
    isDefault: true,
    endpointEnv: "F5_TTS_ENDPOINT",
  },
  {
    id: "fish-speech",
    label: "Fish Speech（本地高质量）",
    kind: "local",
    enabled: true,
    priority: 90,
    endpointEnv: "FISH_SPEECH_ENDPOINT",
  },
  {
    id: "cosyvoice",
    label: "CosyVoice（本地快速）",
    kind: "local",
    enabled: true,
    priority: 80,
    endpointEnv: "COSYVOICE_ENDPOINT",
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs（云端高质量）",
    kind: "cloud",
    enabled: true,
    priority: 70,
    envKeys: ["ELEVENLABS_API_KEY"],
  },
  {
    id: "openai-audio",
    label: "OpenAI TTS（云端）",
    kind: "cloud",
    enabled: false,
    priority: 60,
    envKeys: ["OPENAI_API_KEY"],
  },
  {
    id: "edge-tts",
    label: "Edge TTS（兼容回退）",
    kind: "local",
    enabled: true,
    priority: 10,
  },
];

const overrides = new Map<VoiceCenterProviderId, Partial<VoiceProviderConfig>>();

export function listVoiceProviderConfigs(): VoiceProviderConfig[] {
  return REGISTRY.map((p) => ({ ...p, ...overrides.get(p.id) }));
}

export function getProviderConfig(
  id: VoiceCenterProviderId
): VoiceProviderConfig | undefined {
  return listVoiceProviderConfigs().find((p) => p.id === id);
}

export function setProviderEnabled(id: VoiceCenterProviderId, enabled: boolean) {
  overrides.set(id, { ...overrides.get(id), enabled });
}

export function setDefaultProvider(id: VoiceCenterProviderId) {
  for (const p of REGISTRY) {
    overrides.set(p.id, {
      ...overrides.get(p.id),
      isDefault: p.id === id,
    });
  }
}

export function isProviderEnabled(id: VoiceCenterProviderId): boolean {
  return getProviderConfig(id)?.enabled !== false;
}

export function sortedProviders(
  ids: VoiceCenterProviderId[]
): VoiceCenterProviderId[] {
  const configs = listVoiceProviderConfigs();
  return [...ids]
    .filter((id) => isProviderEnabled(id))
    .sort((a, b) => {
      const pa = configs.find((c) => c.id === a)?.priority ?? 0;
      const pb = configs.find((c) => c.id === b)?.priority ?? 0;
      return pb - pa;
    });
}
