import type { QaIssue, TimelineQaSummary } from "../types";

const MAX_SUBTITLE_CHARS = 36;
const MIN_SHOT_SEC = 0.35;
const MAX_SHOT_SEC = 25;

/** Rule Engine — 黑屏/空镜/字幕/时间/音量/分辨率（时间线级） */
export function runTimelineRuleChecks(
  summary: TimelineQaSummary,
  opts?: { aspectRatio?: string }
): QaIssue[] {
  const issues: QaIssue[] = [];

  if (summary.videoCount === 0) {
    issues.push({
      code: "no_video",
      category: "rule",
      message: "视频轨为空",
      severity: "error",
    });
    return issues;
  }

  const sortedVideo = [...summary.videoClips].sort((a, b) => a.startSec - b.startSec);

  for (const clip of sortedVideo) {
    if (!clip.hasMedia) {
      issues.push({
        code: "empty_shot",
        category: "rule",
        message: `镜头「${clip.label}」缺少可用媒体（空镜头）`,
        clipId: clip.id,
        shotIndex: clip.shotIndex,
        severity: "error",
      });
    }
    if (clip.durationSec < MIN_SHOT_SEC) {
      issues.push({
        code: "shot_too_short",
        category: "rule",
        message: `镜头 ${clip.label} 过短（${clip.durationSec.toFixed(2)}s）`,
        clipId: clip.id,
        shotIndex: clip.shotIndex,
        severity: "warning",
      });
    }
    if (clip.durationSec > MAX_SHOT_SEC) {
      issues.push({
        code: "shot_too_long",
        category: "rule",
        message: `镜头 ${clip.label} 过长（${clip.durationSec.toFixed(1)}s），可能影响节奏`,
        clipId: clip.id,
        shotIndex: clip.shotIndex,
        severity: "warning",
      });
    }
  }

  for (let i = 0; i < sortedVideo.length - 1; i++) {
    const cur = sortedVideo[i]!;
    const next = sortedVideo[i + 1]!;
    const gap = next.startSec - (cur.startSec + cur.durationSec);
    if (gap > 0.15) {
      issues.push({
        code: "timeline_gap",
        category: "rule",
        message: `镜 ${i + 1} 与镜 ${i + 2} 之间存在 ${gap.toFixed(2)}s 空隙`,
        clipId: cur.id,
        severity: "warning",
      });
    }
    if (gap < -0.05) {
      issues.push({
        code: "timeline_overlap",
        category: "rule",
        message: `镜 ${i + 1} 与镜 ${i + 2} 时间重叠`,
        clipId: cur.id,
        severity: "error",
      });
    }
  }

  const subs = [...summary.subtitleClips].sort((a, b) => a.startSec - b.startSec);
  for (let i = 0; i < subs.length; i++) {
    const s = subs[i]!;
    if (!s.text.trim()) {
      issues.push({
        code: "empty_subtitle",
        category: "rule",
        message: "存在空字幕",
        clipId: s.id,
        severity: "error",
      });
    }
    if (s.text.length > MAX_SUBTITLE_CHARS) {
      issues.push({
        code: "subtitle_too_long",
        category: "rule",
        message: `字幕过长（${s.text.length} 字）：${s.text.slice(0, 12)}…`,
        clipId: s.id,
        severity: "warning",
      });
    }
    const dur = s.endSec - s.startSec;
    if (dur <= 0) {
      issues.push({
        code: "subtitle_bad_time",
        category: "rule",
        message: "字幕时间轴错误",
        clipId: s.id,
        severity: "error",
      });
    }
    if (i > 0) {
      const prev = subs[i - 1]!;
      if (s.startSec < prev.endSec - 0.05) {
        issues.push({
          code: "subtitle_overlap",
          category: "rule",
          message: "字幕时间重叠（可能遮挡）",
          clipId: s.id,
          severity: "warning",
        });
      }
    }
  }

  if (summary.subtitleCount > 0 && summary.voiceCount === 0) {
    issues.push({
      code: "subtitle_no_voice",
      category: "rule",
      message: "有字幕但无配音轨，口播可能不同步",
      severity: "warning",
    });
  }

  if (summary.voiceCount > 0 && summary.musicCount === 0) {
    issues.push({
      code: "no_bgm",
      category: "rule",
      message: "有配音但未挂载 BGM",
      severity: "info",
    });
  }

  const ar = opts?.aspectRatio ?? "9:16";
  if (ar !== "9:16" && ar !== "16:9" && ar !== "1:1") {
    issues.push({
      code: "unusual_aspect",
      category: "rule",
      message: `非常见画幅 ${ar}，导出前请确认分辨率`,
      severity: "info",
    });
  }

  return issues;
}
