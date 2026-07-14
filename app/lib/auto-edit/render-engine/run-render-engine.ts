import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  ensureDesktopVeoLayout,
  toDesktopFileUrl,
  desktopVideoPath,
} from "@/app/lib/storage/desktop-veo";
import { createTempDir } from "@/app/lib/storage/workspace-paths";
import { runFfmpegCommand } from "../ffmpeg/runner";
import { buildRenderTimeline } from "./build-timeline";
import { buildFfmpegCommands, outputDesktopRelativePath } from "./build-ffmpeg-commands";
import { validateRenderAssets } from "./validate-assets";
import {
  buildTransitionMergeCommand,
  writeConcatListFile,
} from "../ffmpeg/merge-transitions";
import { buildAssContent } from "../engines/subtitle-engine";
import type { SubtitleEngineOptions } from "../engines/types";
import { buildEffectVideoFilter } from "../engines/effect-engine/build-filters";
import {
  buildAudioMixCommand,
  buildFinalMuxCommand,
  resolveAudioMixDurationSec,
} from "../ffmpeg/mux-final";
import { timelineToSequence, syncClipSpecDurations } from "../edit-graph/timeline-bridge";
import { scaleTimelineToTargetDuration } from "../edit-graph/scale-timeline-duration";
import { ensureVoiceClips } from "../audio/ensure-voice-clips";
import { resolveMediaFilePath } from "../resolve-media";
import type { EditTimeline, MediaPoolItem } from "../edit-graph/types";
import type { RenderEngineParams, RenderEngineResult, RenderPlan } from "./types";

function buildRenderPlan(params: RenderEngineParams): RenderPlan {
  const { sequence, aspectRatio, fps, mode } = params;

  const validation = validateRenderAssets(sequence, mode);
  if (!validation.canRender) {
    throw new Error("没有可渲染的片段，请先在画布上生成首帧或视频");
  }

  const timeline = buildRenderTimeline(sequence, mode, aspectRatio, fps);
  const tmpDir = createTempDir("auto-edit-");

  const built = buildFfmpegCommands({
    sequence,
    mode,
    validation,
    timeline,
    tmpDir,
  });

  if (built.segmentCommands.length === 0) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    throw new Error("没有可渲染的片段，请先在画布上生成首帧或视频");
  }

  return {
    sequence,
    mode,
    ...built,
  };
}

function transitionsForMerge(
  editTimeline: EditTimeline | undefined,
  segmentCount: number,
  segmentDurations: number[]
): { type: import("../types").TransitionType; durationSec: number }[] {
  const out: { type: import("../types").TransitionType; durationSec: number }[] = [];
  const videos = editTimeline?.video ?? [];
  for (let i = 0; i < segmentCount - 1; i++) {
    const clip = videos[i];
    const tr = editTimeline?.transitions.find((t) => t.afterClipId === clip?.id);
    out.push({
      type: tr?.type ?? "cut",
      durationSec: (tr?.durationMs ?? 0) / 1000,
    });
  }
  void segmentDurations;
  return out;
}

/** Render Engine：分段 → 转场 → 配音混音 → 字幕 → 成片 */
export async function runRenderEngine(params: RenderEngineParams): Promise<RenderEngineResult> {
  ensureDesktopVeoLayout();
  const {
    sequence: inputSequence,
    onProgress,
    editTimeline,
    mediaPool,
    bgmUrl,
    bgmVolume,
    voiceId,
    voiceProvider,
    engineSettings,
    synthesizeVoice,
    targetDurationSec,
  } = params;

  const settings = engineSettings;
  let cleanupDir: string | null = null;

  try {
    onProgress?.(5, "渲染引擎：验证素材…");

    let pool = mediaPool ?? [];
    let timeline = editTimeline;

    if (synthesizeVoice !== false && timeline?.voice?.length) {
      onProgress?.(12, "渲染引擎：生成配音…");
      const ensured = await ensureVoiceClips({
        timeline,
        mediaPool: pool,
        voiceId: voiceId ?? settings?.voice.voiceId,
        voiceProvider: voiceProvider ?? settings?.voice.provider,
        renderExport: true,
        onProgress: (pct, msg) => onProgress?.(pct, msg),
      });
      pool = ensured.mediaPool;
      timeline = ensured.timeline;
      if (ensured.failed.length > 0) {
        onProgress?.(
          40,
          `配音完成：成功 ${ensured.synthesized.length + ensured.reused.length} · 失败 ${ensured.failed.length}`
        );
      }
    }

    let renderSequence = inputSequence;

    if (timeline?.video?.length) {
      if (targetDurationSec && targetDurationSec > 0) {
        timeline = scaleTimelineToTargetDuration(timeline, targetDurationSec, pool);
      }
      renderSequence = timelineToSequence(syncClipSpecDurations(timeline));
    }

    const plan = buildRenderPlan({ ...params, sequence: renderSequence });
    const tmpDir = plan.tmpDir;
    cleanupDir = tmpDir;
    onProgress?.(45, `渲染引擎：${plan.validation.readyCount} 个片段就绪`);

    const total = plan.segmentCommands.length;
    const segmentPaths: string[] = [];
    const segmentDurations: number[] = [];

    for (let i = 0; i < total; i++) {
      const cmd = plan.segmentCommands[i];
      onProgress?.(
        Math.round(48 + ((i + 1) / total) * 35),
        `渲染引擎：${cmd.label}`
      );
      await runFfmpegCommand(cmd);
      segmentPaths.push(cmd.outputPath);
      const seg = plan.timeline.segments.filter((s) => s.effectiveKind !== "skip")[i];
      segmentDurations.push(seg?.durationSec ?? 4);
    }

    onProgress?.(68, "渲染引擎：合并转场…");
    const mergedVideoPath = path.join(tmpDir, "merged-video.mp4");
    const transitions = transitionsForMerge(timeline, segmentPaths.length, segmentDurations);
    const mergeCmd = buildTransitionMergeCommand({
      segmentPaths,
      segmentDurations,
      transitions,
      outputPath: mergedVideoPath,
    });

    if (mergeCmd.id === "merge-concat") {
      writeConcatListFile(
        mergedVideoPath.replace(/\.mp4$/i, "-concat.txt"),
        segmentPaths
      );
    }
    await runFfmpegCommand(mergeCmd);

    let videoForMux = mergedVideoPath;
    const useProres = settings?.export.prores === true;
    const outputFileName = `edit-${Date.now()}-${randomUUID().slice(0, 8)}.${useProres ? "mov" : "mp4"}`;
    const outputPath = desktopVideoPath(outputFileName);

    const voiceInputs: { path: string; startSec: number; durationSec: number }[] = [];
    if (timeline?.voice?.length) {
      const seenShots = new Set<number>();
      const sortedVoice = [...timeline.voice].sort((a, b) => a.startSec - b.startSec);
      for (const clip of sortedVoice) {
        const m = /^narr-(\d+)$/.exec(clip.sourceKey);
        const shotIdx = m ? Number(m[1]) : null;
        if (shotIdx !== null && seenShots.has(shotIdx)) continue;
        if (shotIdx !== null) seenShots.add(shotIdx);

        const item = pool.find((p) => p.id === clip.mediaRefId);
        const url = item?.url;
        const fp = resolveMediaFilePath(url);
        if (fp) {
          voiceInputs.push({
            path: fp,
            startSec: clip.startSec,
            durationSec: Math.max(0.3, clip.durationSec),
          });
        }
      }
    }

    const bgmFile = resolveMediaFilePath(bgmUrl);
    let audioPath: string | null = null;

    if (voiceInputs.length > 0 || bgmFile) {
      onProgress?.(78, "渲染引擎：混音…");
      audioPath = path.join(tmpDir, "mixed-audio.aac");
      const mixDurationSec = resolveAudioMixDurationSec({
        renderTimelineSec: plan.timeline.totalDurationSec,
        editTimeline: timeline,
      });
      const mixCmd = buildAudioMixCommand({
        outputPath: audioPath,
        mix: {
          voicePaths: voiceInputs,
          bgmPath: bgmFile,
          bgmVolume: bgmVolume ?? 0.25,
          bgmFadeInSec: settings?.music.fadeInSec ?? 1.5,
          bgmFadeOutSec: settings?.music.fadeOutSec ?? 2,
          bgmLoop: settings?.music.loop ?? true,
          duckUnderVoice: settings?.music.duckUnderVoice ?? true,
          duckAmount: settings?.music.duckAmount ?? 0.55,
          totalDurationSec: mixDurationSec,
        },
        audioPost: settings?.audio,
      });
      if (mixCmd) await runFfmpegCommand(mixCmd);
      else audioPath = null;
    }

    let assPath: string | null = null;
    const burnAss = settings?.subtitle.burnAss !== false;
    if (timeline?.subtitle?.length && burnAss) {
      onProgress?.(86, "渲染引擎：烧录字幕…");
      assPath = path.join(tmpDir, "subs.ass");
      const subtitleOpts: SubtitleEngineOptions = {
        templateId: settings?.subtitle.templateId ?? "default",
        primaryLang: settings?.subtitle.primaryLang,
        secondaryLang: settings?.subtitle.secondaryLang,
        maxCharsPerLine: settings?.subtitle.maxCharsPerLine ?? 18,
        maxLines: settings?.subtitle.maxLines ?? 2,
        highlightKeywords: settings?.subtitle.highlightKeywords,
      };
      fs.writeFileSync(
        assPath,
        buildAssContent(timeline.subtitle, plan.timeline.outputSize, subtitleOpts),
        "utf8"
      );
    }

    if (settings?.effect?.enabled) {
      onProgress?.(88, "渲染引擎：画面特效…");
      const effectOut = path.join(tmpDir, "effect-video.mp4");
      const effectFilter = buildEffectVideoFilter("[0:v]", "vfx", settings.effect);
      if (effectFilter) {
        await runFfmpegCommand({
          id: "effect-pass",
          label: "画面特效",
          outputPath: effectOut,
          args: [
            "-y",
            "-i",
            videoForMux,
            "-filter_complex",
            effectFilter,
            "-map",
            "[vfx]",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            effectOut,
          ],
        });
        videoForMux = effectOut;
      }
    }

    onProgress?.(92, "渲染引擎：最终编码中（烧录字幕/混流，可能需数分钟）…");

    if (!audioPath && !assPath) {
      fs.copyFileSync(videoForMux, outputPath);
    } else {
      const finalCmd = buildFinalMuxCommand({
        videoPath: videoForMux,
        audioPath,
        assPath,
        outputPath,
        outputSize: plan.timeline.outputSize,
        useProres,
      });
      await runFfmpegCommand(finalCmd);
    }

    onProgress?.(100, "完成");
    return {
      outputUrl: toDesktopFileUrl(outputDesktopRelativePath(outputFileName)),
      filepath: outputPath,
      skippedKeys: plan.timeline.skippedKeys,
      plan,
    };
  } finally {
    if (cleanupDir) {
      try {
        fs.rmSync(cleanupDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

export { buildRenderPlan };
