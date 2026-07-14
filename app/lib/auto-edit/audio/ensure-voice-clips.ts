import type { EditTimeline, MediaPoolItem } from "../edit-graph/types";
import { findExistingVoiceOnDisk } from "./reuse-voice-file";
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
  reused: number[];
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
  /** 成片渲染模式：云端 TTS 优先 + 复用磁盘配音 */
  renderExport?: boolean;
  onClip?: (shotIndex: number, message: string) => void;
  onProgress?: (pct: number, message: string) => void;
}): Promise<VoiceEnsureResult> {
  const pool = params.mediaPool.map((p) => ({ ...p }));
  const timeline = { ...params.timeline, voice: [...params.timeline.voice] };
  const synthesized: number[] = [];
  const reused: number[] = [];
  const failed: { shotIndex: number; error: string }[] = [];

  const pending = timeline.voice.filter((clip) => {
    const shotIndex = parseShotFromKey(clip.sourceKey);
    if (shotIndex === null) return false;
    const poolId = clip.mediaRefId ?? `voice-script-${shotIndex}`;
    const item = pool.find((p) => p.id === poolId);
    const text = item?.text ?? clip.label;
    if (!text?.trim()) return false;
    return !(item?.status === "ready" && item.url);
  });

  const total = Math.max(1, pending.length);
  let done = 0;

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

    const pctBase = 12;
    const pctSpan = 28;
    const report = (msg: string) => {
      const pct = Math.round(pctBase + (done / total) * pctSpan);
      params.onProgress?.(pct, msg);
      params.onClip?.(shotIndex, msg);
    };

    report(`配音 · 镜 ${shotIndex + 1}/${timeline.voice.length}`);

    const existing = findExistingVoiceOnDisk(shotIndex);
    if (existing) {
      const idx = pool.findIndex((p) => p.id === poolId);
      const nextItem: MediaPoolItem = {
        id: poolId,
        kind: "voice",
        label: `口播 · 镜 ${shotIndex + 1}`,
        url: existing.url,
        text,
        shotIndex,
        origin: "tts",
        status: "ready",
      };
      if (idx >= 0) pool[idx] = nextItem;
      else pool.push(nextItem);
      clip.mediaRefId = poolId;
      clip.durationSec = existing.durationSec;
      reused.push(shotIndex);
      done++;
      continue;
    }

    await paceBatchVoiceSynth();

    try {
      const synth = await synthesizeVoiceToDesktop({
        text,
        shotIndex,
        voiceId: params.voiceId,
        provider: params.voiceProvider,
        voiceCenterProvider: params.voiceCenterProvider,
        ultraQuality: params.ultraQuality,
        quality: params.quality,
        renderExport: params.renderExport ?? true,
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
      report(`配音 · 镜 ${shotIndex + 1} 失败，继续下一镜`);
    }
    done++;
  }

  params.onProgress?.(40, "配音对齐时间线…");
  const aligned = alignTimelineAfterVoiceSynth(timeline, pool);
  const whisperAligned = await alignSubtitlesWithWhisper(aligned, pool, (msg) =>
    params.onProgress?.(42, msg)
  );

  if (failed.length > 0 && synthesized.length === 0 && reused.length === 0) {
    const sample = failed
      .slice(0, 3)
      .map((f) => `镜${f.shotIndex + 1}`)
      .join("、");
    console.warn(`[ensureVoiceClips] 全部配音失败（${failed.length} 镜），示例：${sample}`);
  }

  return { mediaPool: pool, timeline: whisperAligned, synthesized, reused, failed };
}

function parseShotFromKey(key: string): number | null {
  return parseShotIndexFromNarrKey(key);
}
