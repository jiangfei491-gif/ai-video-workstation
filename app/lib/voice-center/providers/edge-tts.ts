import fs from "fs";
import path from "path";
import { EdgeTTS } from "edge-tts-universal";
import {
  desktopAudioPath,
  ensureDesktopVeoLayout,
  toDesktopFileUrl,
} from "@/app/lib/storage/desktop-veo";
import { prepareTtsText } from "@/app/lib/auto-edit/audio/prepare-tts-text";
import { probeMediaDurationSec } from "@/app/lib/auto-edit/audio/probe-duration";
import { DEFAULT_CN_VOICE } from "@/app/lib/auto-edit/audio/synthesize-voice";
import type { VoiceDirectorTask } from "../types";
import type { ProviderSynthOutput, VoiceCenterProvider } from "./types";

/** Edge TTS 走 Microsoft 在线 WebSocket，偶发 "No audio was received"（限流/网络抖动）。
 *  它是回退链的最后兜底，一次抖动不应拖垮整条流水线，故带指数退避重试。 */
const EDGE_MAX_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 拉取一次 Edge 合成音频，空音频视为失败以触发重试 */
async function fetchEdgeAudio(text: string, voice: string): Promise<Buffer> {
  const tts = new EdgeTTS(text, voice);
  const result = await tts.synthesize();
  const buf = Buffer.from(await result.audio.arrayBuffer());
  if (buf.length === 0) throw new Error("No audio was received.");
  return buf;
}

export async function synthesizeViaEdge(
  task: VoiceDirectorTask,
  tag: string
): Promise<ProviderSynthOutput> {
  ensureDesktopVeoLayout();
  const filename = `voice-${task.id}-${tag}.mp3`;
  const filepath = task.outputPath ?? desktopAudioPath(filename);
  const voice = task.voiceId?.trim() || DEFAULT_CN_VOICE;
  const text = prepareTtsText(task.text);
  if (!text) throw new Error("口播文本为空（规范化后无内容）");

  let buf: Buffer | undefined;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= EDGE_MAX_ATTEMPTS; attempt++) {
    try {
      buf = await fetchEdgeAudio(text, voice);
      break;
    } catch (e) {
      lastErr = e;
      if (attempt < EDGE_MAX_ATTEMPTS) {
        // 指数退避 + 抖动，缓解 Microsoft 端限流
        const backoff = 400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 300);
        await sleep(backoff);
      }
    }
  }
  if (!buf) {
    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    throw new Error(`Edge TTS 重试 ${EDGE_MAX_ATTEMPTS} 次仍失败：${msg}`);
  }

  fs.writeFileSync(filepath, buf);

  const relativePath = path.join("Audio", path.basename(filepath));
  return {
    filepath,
    url: toDesktopFileUrl(relativePath),
    relativePath,
    durationSec: probeMediaDurationSec(filepath),
    voiceId: voice,
    cost: 0,
  };
}

export const edgeTtsBridgeProvider: VoiceCenterProvider = {
  id: "edge-tts",
  label: "Edge TTS",
  kind: "local",
  async healthCheck() {
    return { ok: true, message: "Microsoft Edge TTS（在线）" };
  },
  async synthesize(task) {
    return synthesizeViaEdge(task, "edge");
  },
};
