import type { SubtitlePlanClip, QaIssue } from "../types";
import { estimateReadingCps } from "./layout-engine";

const MAX_READING_CPS = 8;
const MAX_CHARS = 36;

/** QA Engine：自动检查并可标记需修正项 */
export function runSubtitleQa(clips: SubtitlePlanClip[]): QaIssue[] {
  const issues: QaIssue[] = [];
  const sorted = [...clips].sort((a, b) => a.startSec - b.startSec);

  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]!;
    const dur = c.endSec - c.startSec;

    if (!c.text.trim()) {
      issues.push({
        code: "empty",
        message: "空字幕",
        clipId: c.id,
        severity: "error",
      });
    }
    if (dur <= 0) {
      issues.push({
        code: "bad_time",
        message: "时间轴错误（结束早于开始）",
        clipId: c.id,
        severity: "error",
      });
    }
    if (c.text.length > MAX_CHARS) {
      issues.push({
        code: "too_long",
        message: `字幕过长（${c.text.length} 字）`,
        clipId: c.id,
        severity: "warning",
      });
    }
    const cps = estimateReadingCps(c.text, dur);
    if (cps > MAX_READING_CPS) {
      issues.push({
        code: "reading_speed",
        message: `阅读速度过快（${cps.toFixed(1)} 字/秒）`,
        clipId: c.id,
        severity: "warning",
      });
    }
    if (i > 0) {
      const prev = sorted[i - 1]!;
      if (c.startSec < prev.endSec - 0.05) {
        issues.push({
          code: "overlap",
          message: "字幕时间重叠",
          clipId: c.id,
          severity: "warning",
        });
      }
    }
  }

  return issues;
}

/** 简单自动修正：裁剪重叠、保证最小时长 */
export function autoFixSubtitleClips(clips: SubtitlePlanClip[]): SubtitlePlanClip[] {
  const sorted = [...clips].sort((a, b) => a.startSec - b.startSec);
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]!;
    if (c.endSec - c.startSec < 0.3) c.endSec = c.startSec + 0.3;
    if (i > 0) {
      const prev = sorted[i - 1]!;
      if (c.startSec < prev.endSec) c.startSec = prev.endSec;
      if (c.endSec <= c.startSec) c.endSec = c.startSec + 0.3;
    }
  }
  return sorted;
}
