import type { FfmpegCommand } from "../render-engine/types";
import { buildBgmAudioFilter } from "../engines/music-engine";
import { buildVoicePostFilter } from "../engines/audio-engine/build-filters";
import type { EditEngineSettings } from "../engines/edit-settings";
import type { EditTimeline } from "../edit-graph/types";

/** 混音总时长：以实际渲染视频为准，避免 EditGraph 与 Sequence 不同步时截断后半段配音 */
export function resolveAudioMixDurationSec(params: {
  renderTimelineSec: number;
  editTimeline?: EditTimeline;
}): number {
  const { renderTimelineSec, editTimeline } = params;
  const editSec = editTimeline?.durationSec ?? 0;
  const voiceEnd =
    editTimeline?.voice?.reduce(
      (max, c) => Math.max(max, c.startSec + c.durationSec),
      0
    ) ?? 0;
  const videoEnd =
    editTimeline?.video?.reduce(
      (max, c) => Math.max(max, c.startSec + c.durationSec),
      0
    ) ?? 0;
  return Math.max(renderTimelineSec, editSec, voiceEnd, videoEnd, 1);
}

export type AudioMixInput = {
  voicePaths: { path: string; startSec: number; volume?: number }[];
  bgmPath?: string | null;
  bgmVolume?: number;
  bgmStartSec?: number;
  bgmFadeInSec?: number;
  bgmFadeOutSec?: number;
  bgmLoop?: boolean;
  duckUnderVoice?: boolean;
  duckAmount?: number;
  totalDurationSec: number;
};

/** 混音：口播轨 + 可选 BGM */
export function buildAudioMixCommand(params: {
  outputPath: string;
  mix: AudioMixInput;
  audioPost?: EditEngineSettings["audio"];
}): FfmpegCommand | null {
  const { mix, outputPath, audioPost } = params;
  if (mix.voicePaths.length === 0 && !mix.bgmPath) return null;

  const args: string[] = ["-y"];
  const filters: string[] = [];
  let inputIdx = 0;
  const voiceLabels: string[] = [];

  for (const v of mix.voicePaths) {
    args.push("-i", v.path);
    const delayMs = Math.round(v.startSec * 1000);
    const vol = v.volume ?? 1;
    const post = buildVoicePostFilter(`[${inputIdx}:a]`, `va${inputIdx}`, audioPost ?? {});
    if (post) {
      filters.push(`${post};[va${inputIdx}]adelay=${delayMs}|${delayMs},volume=${vol}[vad${inputIdx}]`);
      voiceLabels.push(`[vad${inputIdx}]`);
    } else {
      filters.push(
        `[${inputIdx}:a]adelay=${delayMs}|${delayMs},volume=${vol}[va${inputIdx}]`
      );
      voiceLabels.push(`[va${inputIdx}]`);
    }
    inputIdx++;
  }

  let voiceOut = "";
  if (voiceLabels.length > 0) {
    voiceOut = "voicebus";
    filters.push(
      `${voiceLabels.join("")}amix=inputs=${voiceLabels.length}:duration=longest:dropout_transition=0[${voiceOut}]`
    );
  }

  if (mix.bgmPath) {
    args.push("-i", mix.bgmPath);
    const bgmIdx = inputIdx;
    inputIdx++;

    const bgmFilter = buildBgmAudioFilter(`${bgmIdx}:a`, "bgmready", {
      bgmPath: mix.bgmPath,
      volume: mix.bgmVolume ?? 0.25,
      fadeInSec: mix.bgmFadeInSec ?? 1.5,
      fadeOutSec: mix.bgmFadeOutSec ?? 2,
      loop: mix.bgmLoop ?? true,
      duckUnderVoice: mix.duckUnderVoice,
      duckAmount: mix.duckAmount,
      totalDurationSec: mix.totalDurationSec,
    });

    if (voiceOut) {
      filters.push(bgmFilter);
      const duck = mix.duckUnderVoice !== false;
      if (duck) {
        const amount = Math.max(0.2, Math.min(1, mix.duckAmount ?? 0.55));
        const ratio = Math.round(4 + (1 - amount) * 10);
        filters.push(`[${voiceOut}]asplit=2[v_mix][v_side]`);
        filters.push(
          `[bgmready][v_side]sidechaincompress=threshold=0.015:ratio=${ratio}:attack=50:release=450:makeup=0:link=average[bgmduck]`
        );
        filters.push(`[v_mix][bgmduck]amix=inputs=2:duration=first:dropout_transition=0[aout]`);
      } else {
        filters.push(`[${voiceOut}][bgmready]amix=inputs=2:duration=first:dropout_transition=0[aout]`);
      }
    } else {
      filters.push(bgmFilter.replace("[bgmready]", "[aout]"));
    }
  } else if (voiceOut) {
    filters.push(`[${voiceOut}]anull[aout]`);
  } else {
    return null;
  }

  return {
    id: "audio-mix",
    label: "混音",
    outputPath,
    args: [
      ...args,
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[aout]",
      "-t",
      String(Math.max(1, mix.totalDurationSec)),
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      outputPath,
    ],
  };
}

/** 视频 + 音轨 + ASS 字幕 → 最终 MP4 */
export function buildFinalMuxCommand(params: {
  videoPath: string;
  audioPath?: string | null;
  assPath?: string | null;
  outputPath: string;
  outputSize: { w: number; h: number };
  useProres?: boolean;
}): FfmpegCommand {
  const { videoPath, audioPath, assPath, outputPath, useProres } = params;
  const args = ["-y", "-i", videoPath];

  if (audioPath) {
    args.push("-i", audioPath);
  }

  if (assPath) {
    const escaped = assPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
    args.push("-vf", `ass='${escaped}'`);
    args.push("-c:v", useProres ? "prores_ks" : "libx264", "-pix_fmt", useProres ? "yuv422p10le" : "yuv420p");
  } else {
    args.push("-c:v", useProres ? "prores_ks" : "copy");
  }

  if (audioPath) {
    // 不用 -shortest：混音轨应与成片等长；若音频偏短，保留完整视频并在尾部静音
    args.push("-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac");
  }

  // moov 必须在文件头，否则浏览器 <video> 无法预览（需下完整 30MB 才播）
  if (!useProres) {
    args.push("-movflags", "+faststart");
  }

  args.push(outputPath);

  return {
    id: "final-mux",
    label: "合成成片",
    outputPath,
    args,
  };
}
