import fs from "fs";
import path from "path";
import { EdgeTTS } from "edge-tts-universal";
import {
  desktopAudioPath,
  ensureDesktopVeoLayout,
  toDesktopFileUrl,
} from "@/app/lib/storage/desktop-veo";
import { runVoiceCenterTask } from "@/app/lib/voice-center";
import type { VoiceCenterProviderId } from "@/app/lib/voice-center";
import { getVoiceProvider } from "../engines/voice-engine";
import type { VoiceProviderId } from "../engines/types";
import { prepareTtsText } from "./prepare-tts-text";
import { probeMediaDurationSec } from "./probe-duration";

export const DEFAULT_CN_VOICE = "zh-CN-XiaoxiaoNeural";

function toVoiceCenterProvider(
  provider?: VoiceProviderId
): VoiceCenterProviderId | undefined {
  switch (provider) {
    case "edge-tts":
      return "edge-tts";
    case "openai-audio":
      return "openai-audio";
    case "elevenlabs":
      return "elevenlabs";
    default:
      return undefined;
  }
}

export type VoiceSynthResult = {
  filepath: string;
  url: string;
  durationSec: number;
  relativePath: string;
  provider?: VoiceCenterProviderId;
  sentenceTimestamp?: import("@/app/lib/voice-center").SentenceTimestamp[];
  wordTimestamp?: import("@/app/lib/voice-center").WordTimestamp[];
};

/** 按 provider 合成单条口播，写入 Workspace 项目 audio 目录 */
export async function synthesizeVoiceToDesktop(params: {
  text: string;
  shotIndex: number;
  voiceId?: string;
  provider?: VoiceProviderId;
  voiceCenterProvider?: VoiceCenterProviderId;
  ultraQuality?: boolean;
  quality?: import("@/app/lib/voice-center").VoiceQualityHint;
}): Promise<VoiceSynthResult> {
  const text = params.text.trim();
  if (!text) throw new Error("口播文本为空");

  ensureDesktopVeoLayout();
  const providerId = params.provider;
  const centerProvider =
    params.voiceCenterProvider ?? toVoiceCenterProvider(providerId);

  // 尚未接入配音中心的旧 Provider
  if (providerId === "google-tts" || providerId === "azure-tts") {
    const legacyId = providerId;
    const voiceProvider = getVoiceProvider(legacyId);
    const filename = `voice-shot-${params.shotIndex}-${legacyId}.mp3`;
    const filepath = desktopAudioPath(filename);
    const result = await voiceProvider.synthesize({
      text,
      shotIndex: params.shotIndex,
      voiceId: params.voiceId,
      outputPath: filepath,
    });
    const baseName = path.basename(result.filepath);
    const relativePath = path.join("Audio", baseName);
    return {
      filepath: result.filepath,
      url: toDesktopFileUrl(relativePath),
      durationSec: result.durationSec,
      relativePath,
    };
  }

  const tag = centerProvider ?? "auto";
  const filename = `voice-shot-${params.shotIndex}-${tag}.mp3`;
  const outputPath = desktopAudioPath(filename);

  const result = await runVoiceCenterTask({
    id: `shot-${params.shotIndex}`,
    text,
    shotIndex: params.shotIndex,
    voiceId: params.voiceId,
    provider: centerProvider,
    ultraQuality: params.ultraQuality,
    quality: params.quality,
    outputPath,
  });

  if (result.status === "failed") {
    throw new Error(result.error ?? "配音失败");
  }

  return {
    filepath: result.audio.filepath,
    url: result.audio.url,
    durationSec: result.duration,
    relativePath: result.audio.relativePath,
    provider: result.provider,
    sentenceTimestamp: result.sentenceTimestamp,
    wordTimestamp: result.wordTimestamp,
  };
}

/** @deprecated 保留旧 Edge 直调路径，供测试或紧急回退 */
export async function synthesizeVoiceViaEdgeLegacy(params: {
  text: string;
  shotIndex: number;
  voiceId?: string;
}): Promise<VoiceSynthResult> {
  const text = params.text.trim();
  if (!text) throw new Error("口播文本为空");

  ensureDesktopVeoLayout();
  const filename = `voice-shot-${params.shotIndex}.mp3`;
  const filepath = desktopAudioPath(filename);
  const voice = params.voiceId?.trim() || DEFAULT_CN_VOICE;

  const tts = new EdgeTTS(prepareTtsText(text), voice);
  const result = await tts.synthesize();
  const buf = Buffer.from(await result.audio.arrayBuffer());
  fs.writeFileSync(filepath, buf);

  const durationSec = probeMediaDurationSec(filepath);
  const relativePath = path.join("Audio", filename);

  return {
    filepath,
    url: toDesktopFileUrl(relativePath),
    durationSec,
    relativePath,
  };
}
