import type { TransitionType } from "@/app/lib/auto-edit/types";
import type { DirectorPlan } from "@/app/lib/director-plan/types";
import type { OpenCutCommand, OpenCutTrackType } from "@/app/lib/opencut/commands";

const TRACK: Record<OpenCutTrackType, number> = {
  video: 0,
  audio: 1,
  text: 2,
};

/**
 * Clip Agent：Director Plan → OpenCut 可执行命令序列。
 * 只翻译，不思考。
 */
export function directorPlanToOpenCutCommands(
  plan: DirectorPlan,
  opts?: { includeExport?: boolean }
): OpenCutCommand[] {
  const commands: OpenCutCommand[] = [
    {
      action: "createProject",
      name: plan.title,
      fps: plan.fps,
      aspectRatio: plan.aspectRatio,
    },
  ];

  const mediaSeen = new Set<string>();

  for (const clip of plan.clips) {
    if (clip.assetUrl && !mediaSeen.has(clip.assetId)) {
      mediaSeen.add(clip.assetId);
      commands.push({
        action: "addMedia",
        assetId: clip.assetId,
        url: clip.assetUrl,
        kind: clip.assetUrl.match(/\.(mp4|webm|mov)$/i) ? "video" : "image",
      });
    }
  }

  if (plan.voice?.assetUrl && !mediaSeen.has(plan.voice.assetId)) {
    mediaSeen.add(plan.voice.assetId);
    commands.push({
      action: "addMedia",
      assetId: plan.voice.assetId,
      url: plan.voice.assetUrl,
      kind: "audio",
    });
  }

  if (plan.music?.assetUrl && !mediaSeen.has(plan.music.assetId)) {
    mediaSeen.add(plan.music.assetId);
    commands.push({
      action: "addMedia",
      assetId: plan.music.assetId,
      url: plan.music.assetUrl,
      kind: "audio",
    });
  }

  for (const clip of plan.clips) {
    commands.push({
      action: "insertClip",
      trackType: "video",
      trackIndex: TRACK.video,
      clipId: clip.id,
      assetId: clip.assetId,
      start: clip.startSec,
      duration: clip.durationSec,
      label: clip.label,
    });

    if (clip.transitionAfter) {
      commands.push({
        action: "setTransition",
        afterClipId: clip.id,
        type: clip.transitionAfter.type,
        durationMs: clip.transitionAfter.durationMs,
      });
    }
  }

  if (plan.voice?.assetUrl) {
    const totalDur = plan.clips.reduce((s, c) => s + c.durationSec, 0);
    commands.push({
      action: "insertClip",
      trackType: "audio",
      trackIndex: TRACK.audio,
      clipId: "voice-main",
      assetId: plan.voice.assetId,
      start: 0,
      duration: totalDur,
      label: "配音",
    });
    if (plan.voice.volume != null) {
      commands.push({
        action: "setVolume",
        trackType: "audio",
        trackIndex: TRACK.audio,
        clipId: "voice-main",
        volume: plan.voice.volume,
      });
    }
  }

  if (plan.music?.assetUrl) {
    commands.push({
      action: "insertClip",
      trackType: "audio",
      trackIndex: TRACK.audio + 1,
      clipId: "music-main",
      assetId: plan.music.assetId,
      start: plan.music.startSec ?? 0,
      duration: plan.music.durationSec ?? plan.clips.reduce((s, c) => s + c.durationSec, 0),
      label: "背景音乐",
    });
    if (plan.music.volume != null) {
      commands.push({
        action: "setVolume",
        trackType: "audio",
        trackIndex: TRACK.audio + 1,
        clipId: "music-main",
        volume: plan.music.volume,
      });
    }
  }

  for (const sub of plan.subtitles) {
    commands.push({
      action: "insertSubtitle",
      clipId: sub.id,
      text: sub.text,
      start: sub.startSec,
      duration: sub.durationSec,
      style: sub.style,
    });
  }

  if (opts?.includeExport) {
    commands.push({ action: "exportVideo", format: "mp4", quality: "high" });
  }

  return commands;
}

/** 兼容旧 EditGraph 命令路径（过渡期） */
export function transitionTypeLabel(type: TransitionType): string {
  return type;
}
