import fs from "fs";
import path from "path";

import {
  desktopAudioPath,
  ensureDesktopVeoLayout,
  toDesktopFileUrl,
} from "@/app/lib/storage/desktop-veo";
import { prepareTtsText } from "@/app/lib/auto-edit/audio/prepare-tts-text";
import { probeMediaDurationSec } from "@/app/lib/auto-edit/audio/probe-duration";
import type { VoiceDirectorTask } from "../types";
import type { ProviderSynthOutput, VoiceCenterProvider } from "./types";
import { probeTtsEndpoint, readEndpoint } from "./endpoint-probe";
import { synthesizeViaEdge } from "./edge-tts";

export type { EndpointProbeResult } from "./endpoint-probe";

/** 单条口播的本地引擎合成超时。默认 90s（单句 CPU 推理足够），
 *  过长（原 300s）会在引擎卡住时按镜头数成倍拖垮整条流水线。可用 LOCAL_TTS_TIMEOUT_MS 覆盖。 */
const LOCAL_SYNTH_TIMEOUT_MS = Number(process.env.LOCAL_TTS_TIMEOUT_MS) || 90_000;

async function postStandardSynthesize(
  endpoint: string,
  task: VoiceDirectorTask,
  tag: string
): Promise<ProviderSynthOutput> {
  ensureDesktopVeoLayout();
  const res = await fetch(`${endpoint.replace(/\/$/, "")}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: prepareTtsText(task.text),
      voice_id: task.voiceId,
      speed: task.speed,
      pitch: task.pitch,
      emotion: task.emotion,
      language: task.language,
    }),
    signal: AbortSignal.timeout(LOCAL_SYNTH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`本地引擎 ${tag} 失败 (${res.status})`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  let durationSec = 0;
  let filepath: string;

  if (contentType.includes("application/json")) {
    const data = (await res.json()) as { audio?: string; duration?: number };
    if (!data.audio) throw new Error(`本地引擎 ${tag} 未返回 audio`);
    const filename = `voice-${task.id}-${tag}.wav`;
    filepath = task.outputPath ?? desktopAudioPath(filename);
    fs.writeFileSync(filepath, Buffer.from(data.audio, "base64"));
    durationSec = data.duration ?? probeMediaDurationSec(filepath);
  } else {
    const buf = Buffer.from(await res.arrayBuffer());
    const filename = `voice-${task.id}-${tag}.wav`;
    filepath = task.outputPath ?? desktopAudioPath(filename);
    fs.writeFileSync(filepath, buf);
    durationSec = probeMediaDurationSec(filepath);
  }

  const relativePath = path.join("Audio", path.basename(filepath));
  return {
    filepath,
    url: toDesktopFileUrl(relativePath),
    relativePath,
    durationSec,
    voiceId: task.voiceId ?? "default",
    cost: 0,
  };
}

function localProvider(
  id: "f5-tts" | "fish-speech" | "cosyvoice",
  label: string,
  endpointEnv: string,
  edgeCompat?: boolean
): VoiceCenterProvider {
  return {
    id,
    label,
    kind: "local",
    async healthCheck() {
      const endpoint = readEndpoint(endpointEnv);
      if (!endpoint) {
        if (edgeCompat) return { ok: true, message: "兼容模式（Edge TTS）" };
        return { ok: false, message: `未配置 ${endpointEnv}` };
      }
      const probe = await probeTtsEndpoint(endpointEnv);
      return {
        ok: probe.ok,
        latencyMs: probe.latencyMs,
        message: probe.ok
          ? `${probe.message} · ${probe.endpoint}`
          : `${probe.message} · ${probe.endpoint}`,
      };
    },
    async synthesize(task) {
      const endpoint = readEndpoint(endpointEnv);
      if (endpoint) {
        return postStandardSynthesize(endpoint, task, id);
      }
      if (edgeCompat) {
        return synthesizeViaEdge(task, id);
      }
      throw new Error(`${label} 未配置 ${endpointEnv}`);
    },
  };
}

export const f5TtsProvider = localProvider("f5-tts", "F5-TTS", "F5_TTS_ENDPOINT", true);
export const fishSpeechProvider = localProvider("fish-speech", "Fish Speech", "FISH_SPEECH_ENDPOINT");
export const cosyVoiceProvider = localProvider("cosyvoice", "CosyVoice", "COSYVOICE_ENDPOINT");

export { edgeTtsBridgeProvider } from "./edge-tts";
