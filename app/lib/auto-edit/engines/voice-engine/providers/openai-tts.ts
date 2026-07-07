import fs from "fs";
import OpenAI from "openai";
import { getOpenAIApiKey } from "@/app/lib/openai-key";
import {
  desktopAudioPath,
  ensureDesktopVeoLayout,
  toDesktopFileUrl,
} from "@/app/lib/storage/desktop-veo";
import { probeMediaDurationSec } from "../../../audio/probe-duration";
import { prepareTtsText, OPENAI_TTS_INSTRUCTIONS_ZH } from "../../../audio/prepare-tts-text";
import type { VoiceProvider } from "../types";

export const openAiTtsProvider: VoiceProvider = {
  id: "openai-audio",
  label: "OpenAI Audio",
  available: () => Boolean(getOpenAIApiKey()),
  async synthesize(params) {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) throw new Error("未配置 OPENAI_API_KEY");

    ensureDesktopVeoLayout();
    const filepath = params.outputPath || desktopAudioPath(`voice-shot-${params.shotIndex}-openai.mp3`);
    const voice = params.voiceId?.trim() || "alloy";

    const openai = new OpenAI({ apiKey });
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      input: prepareTtsText(params.text),
      instructions: OPENAI_TTS_INSTRUCTIONS_ZH,
    });

    const buf = Buffer.from(await speech.arrayBuffer());
    fs.writeFileSync(filepath, buf);

    const durationSec = probeMediaDurationSec(filepath);
    return {
      filepath,
      durationSec,
      provider: "openai-audio",
    };
  },
};

export function openAiVoiceUrl(filepath: string, filename: string) {
  return toDesktopFileUrl(`Audio/${filename}`);
}
