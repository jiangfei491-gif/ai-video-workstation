import fs from "fs";
import {
  desktopAudioPath,
  ensureDesktopVeoLayout,
} from "@/app/lib/storage/desktop-veo";
import { prepareTtsText } from "../../../audio/prepare-tts-text";
import { probeMediaDurationSec } from "../../../audio/probe-duration";
import type { VoiceProvider } from "../types";
import { recordCost, UNIT_PRICING } from "@/app/lib/cost-ledger/unified";

export const ELEVENLABS_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

function getElevenLabsApiKey(): string | undefined {
  return process.env.ELEVENLABS_API_KEY?.trim() || undefined;
}

export const elevenLabsTtsProvider: VoiceProvider = {
  id: "elevenlabs",
  label: "ElevenLabs",
  available: () => Boolean(getElevenLabsApiKey()),
  async synthesize(params) {
    const apiKey = getElevenLabsApiKey();
    if (!apiKey) throw new Error("未配置 ELEVENLABS_API_KEY");

    ensureDesktopVeoLayout();
    const filepath =
      params.outputPath || desktopAudioPath(`voice-shot-${params.shotIndex}-elevenlabs.mp3`);
    const voiceId = params.voiceId?.trim() || ELEVENLABS_DEFAULT_VOICE;

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: prepareTtsText(params.text),
        model_id: "eleven_multilingual_v2",
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`ElevenLabs 合成失败 (${res.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filepath, buf);

    // 汇入全平台成本总账（ElevenLabs 按字符）
    try {
      const chars = (params.text ?? "").length;
      recordCost({
        module: "配音中心",
        operation: "配音合成",
        provider: "elevenlabs",
        model: "eleven_multilingual_v2",
        units: chars,
        unitKind: "字符",
        costUsd: (chars / 1000) * UNIT_PRICING["elevenlabs-per-1k-chars"],
        estimated: true,
      });
    } catch {
      /* 记账失败不影响合成 */
    }

    return {
      filepath,
      durationSec: probeMediaDurationSec(filepath),
      provider: "elevenlabs",
    };
  },
};
