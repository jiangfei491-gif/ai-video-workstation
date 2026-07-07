import type { EditTimeline, MediaPoolItem } from "../edit-graph/types";
import { synthesizeVoiceToDesktop } from "./synthesize-voice";
import { alignTimelineAfterVoiceSynth, parseShotIndexFromNarrKey } from "./align-voice-subtitle";
import { alignSubtitlesWithWhisper } from "./transcribe-align";
import type { VoiceCenterProviderId, VoiceQualityHint } from "@/app/lib/voice-center";

/** 批量配音时镜头间限速，降低 Edge TTS 被 Microsoft 限流概率。可用 VOICE_BATCH_GAP_MS 覆盖。 */
const VOICE_BATCH_GAP_MS = Number(process.env.VOICE_BATCH_GAP_MS) || 350;
const VOICE_BATCH_GAP_JITTER_MS = Number(process.env.VOICE_BATCH_GAP_JITTER_MS) || 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function paceBatchVoiceSynth(): Promise<void> {
  if (VOICE_BATCH_GAP_MS <= 0) return;
  const jitter =
    VOICE_BATCH_GAP_JITTER_MS > 0
      ? Math.floor(Math.random() * VOICE_BATCH_GAP_JITTER_MS)
      : 0;
  await sleep(VOICE_BATCH_GAP_MS + jitter);
}

export type VoiceEnsureResult = {
  mediaPool: MediaPoolItem[];
  timeline: EditTimeline;
  synthesized: number[];
  failed: { shotIndex: number; error: string }[];
};

/** 为 timeline.voice 中待生成的条目合成 TTS，并更新 mediaPool */
export async function ensureVoiceClips(params: {
  timeline: EditTimeline;
  mediaPool: MediaPoolItem[];
  voiceId?: string;
  voiceProvider?: import("../engines/types").VoiceProviderId;
  voiceCenterProvider?: VoiceCenterProviderId;
  ultraQuality?: boolean;
  quality?: VoiceQualityHint;
  onClip?: (shotIndex: number, message: string) => void;
  onProgress?: (message: string) => void;
}): Promise<VoiceEnsureResult> {
  const pool = params.mediaPool.map((p) => ({ ...p }));
  const timeline = { ...params.timeline, voice: [...params.timeline.voice] };
  const synthesized: number[] = [];
  const failed: { shotIndex: number; error: string }[] = [];

  for (const clip of timeline.voice) {
    const shotIndex = parseShotFromKey(clip.sourceKey);
    if (shotIndex === null) continue;

    const poolId = clip.mediaRefId ?? `voice-script-${shotIndex}`;
    const item = pool.find((p) => p.id === poolId);
    const text = item?.text ?? clip.label;
    if (!text?.trim()) continue;

    if (item?.status === "ready" && item.url) {
      clip.mediaRefId = item.id;
      continue;
    }

    params.onClip?.(shotIndex, `配音 · 镜 ${shotIndex + 1}`);
    await paceBatchVoiceSynth();

    // 单镜头配音失败不应拖垮整批：记录失败、保留原镜长估算，继续下一镜
    try {
      const synth = await synthesizeVoiceToDesktop({
        text,
        shotIndex,
        voiceId: params.voiceId,
        provider: params.voiceProvider,
        voiceCenterProvider: params.voiceCenterProvider,
        ultraQuality: params.ultraQuality,
        quality: params.quality,
      });

      const idx = pool.findIndex((p) => p.id === poolId);
      const nextItem: MediaPoolItem = {
        id: poolId,
        kind: "voice",
        label: `口播 · 镜 ${shotIndex + 1}`,
        url: synth.url,
        text,
        shotIndex,
        origin: "tts",
        status: "ready",
      };
      if (idx >= 0) pool[idx] = nextItem;
      else pool.push(nextItem);

      clip.mediaRefId = poolId;
      clip.durationSec = synth.durationSec;
      synthesized.push(shotIndex);
    } catch (e) {
      const idx = pool.findIndex((p) => p.id === poolId);
      const missingItem: MediaPoolItem = {
        id: poolId,
        kind: "voice",
        label: `口播 · 镜 ${shotIndex + 1}（失败）`,
        text,
        shotIndex,
        origin: "tts",
        status: "missing",
      };
      if (idx >= 0) pool[idx] = missingItem;
      else pool.push(missingItem);

      clip.mediaRefId = poolId;
      failed.push({ shotIndex, error: e instanceof Error ? e.message : String(e) });
      params.onClip?.(shotIndex, `配音 · 镜 ${shotIndex + 1} 失败`);
    }
  }

  const aligned = alignTimelineAfterVoiceSynth(timeline, pool);
  const whisperAligned = await alignSubtitlesWithWhisper(
    aligned,
    pool,
    (msg) => params.onProgress?.(msg)
  );

  return { mediaPool: pool, timeline: whisperAligned, synthesized, failed };
}

function parseShotFromKey(key: string): number | null {
  return parseShotIndexFromNarrKey(key);
}
