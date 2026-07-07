import type { VoiceCenterProviderId } from "../types";
import type { VoiceCenterProvider } from "./types";
import {
  cosyVoiceProvider,
  edgeTtsBridgeProvider,
  f5TtsProvider,
  fishSpeechProvider,
} from "./local";
import { elevenLabsProvider, openAiAudioProvider } from "./cloud";

const ALL: VoiceCenterProvider[] = [
  f5TtsProvider,
  fishSpeechProvider,
  cosyVoiceProvider,
  elevenLabsProvider,
  openAiAudioProvider,
  edgeTtsBridgeProvider,
];

export function getVoiceCenterProvider(
  id: VoiceCenterProviderId
): VoiceCenterProvider | undefined {
  return ALL.find((p) => p.id === id);
}

export function listVoiceCenterProviders(): VoiceCenterProvider[] {
  return ALL;
}
