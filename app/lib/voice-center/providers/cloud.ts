import path from "path";
import {
  desktopAudioPath,
  ensureDesktopVeoLayout,
  toDesktopFileUrl,
} from "@/app/lib/storage/desktop-veo";
import { elevenLabsTtsProvider } from "@/app/lib/auto-edit/engines/voice-engine/providers/elevenlabs";
import { openAiTtsProvider } from "@/app/lib/auto-edit/engines/voice-engine/providers/openai-tts";
import { ELEVENLABS_DEFAULT_VOICE } from "@/app/lib/auto-edit/engines/voice-engine/providers/elevenlabs";
import type { VoiceDirectorTask } from "../types";
import type { ProviderSynthOutput, VoiceCenterProvider } from "./types";

async function synthCloud(
  task: VoiceDirectorTask,
  provider: "elevenlabs" | "openai-audio",
  voiceDefault: string
): Promise<ProviderSynthOutput> {
  ensureDesktopVeoLayout();
  const shot = task.shotIndex ?? 0;
  const ext = provider === "openai-audio" ? "mp3" : "mp3";
  const filepath =
    task.outputPath ??
    desktopAudioPath(`voice-${task.id}-${provider}.${ext}`);

  const engine =
    provider === "elevenlabs" ? elevenLabsTtsProvider : openAiTtsProvider;

  const result = await engine.synthesize({
    text: task.text,
    shotIndex: shot,
    voiceId: task.voiceId ?? voiceDefault,
    outputPath: filepath,
  });

  const relativePath = path.join("Audio", path.basename(result.filepath));
  return {
    filepath: result.filepath,
    url: toDesktopFileUrl(relativePath),
    relativePath,
    durationSec: result.durationSec,
    voiceId: task.voiceId ?? voiceDefault,
    cost: provider === "elevenlabs" ? 0.02 : 0.015,
  };
}

export const elevenLabsProvider: VoiceCenterProvider = {
  id: "elevenlabs",
  label: "ElevenLabs",
  kind: "cloud",
  async healthCheck() {
    const ok = elevenLabsTtsProvider.available();
    if (!ok) return { ok: false, message: "缺少 ELEVENLABS_API_KEY" };
    try {
      const res = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!.trim() },
        signal: AbortSignal.timeout(8000),
      });
      return {
        ok: res.ok,
        message: res.ok ? "ElevenLabs API 可用" : `HTTP ${res.status}`,
      };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },
  async synthesize(task) {
    return synthCloud(task, "elevenlabs", ELEVENLABS_DEFAULT_VOICE);
  },
};

export const openAiAudioProvider: VoiceCenterProvider = {
  id: "openai-audio",
  label: "OpenAI TTS",
  kind: "cloud",
  async healthCheck() {
    const ok = openAiTtsProvider.available();
    if (!ok) return { ok: false, message: "缺少 OPENAI_API_KEY" };
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}` },
        signal: AbortSignal.timeout(8000),
      });
      return {
        ok: res.ok,
        message: res.ok ? "OpenAI TTS API 可用" : `HTTP ${res.status}`,
      };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },
  async synthesize(task) {
    return synthCloud(task, "openai-audio", "alloy");
  },
};
