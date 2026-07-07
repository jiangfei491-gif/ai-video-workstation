import type { BuildEditInput } from "../types";
import type { ScriptSegment } from "./types";

export type StoryboardShotInput = BuildEditInput["storyboard"][number];

/** 口播/字幕文本：旁白 → 动作+环境 → 占位 */
export function resolveShotNarrationText(sb: StoryboardShotInput): string {
  const narration = (sb.narration ?? "").trim();
  if (narration) return narration;
  const fallback = [sb.action, sb.environment].filter(Boolean).join(" · ");
  if (fallback) return fallback;
  return `镜头 ${sb.shotIndex + 1}`;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？；.!?])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 按分镜旁白 1:1 构建 scriptMap（最准确） */
export function buildShotFirstScriptMap(input: BuildEditInput): ScriptSegment[] {
  const segments: ScriptSegment[] = [];

  for (const sb of input.storyboard) {
    const text = resolveShotNarrationText(sb);
    segments.push({
      id: `narr-${sb.shotIndex}`,
      text,
      shotIndex: sb.shotIndex,
      source: "storyboard",
    });
  }

  return segments;
}

function splitScriptParagraphs(script: string): string[] {
  return script
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchSentenceToShot(sentence: string, input: BuildEditInput): number | undefined {
  const norm = sentence.replace(/\s/g, "");
  if (!norm) return undefined;

  let bestIdx: number | undefined;
  let bestScore = 0;

  for (const sb of input.storyboard) {
    const narration = (sb.narration ?? "").replace(/\s/g, "");
    if (!narration) continue;
    if (norm.includes(narration) || narration.includes(norm)) {
      return sb.shotIndex;
    }
    const prefix = narration.slice(0, Math.min(8, narration.length));
    if (prefix.length >= 4 && norm.includes(prefix)) {
      const score = prefix.length;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = sb.shotIndex;
      }
    }
  }
  return bestIdx;
}

/** 从编导脚本 + 分镜旁白构建 scriptMap（全文拆分 + 规则匹配） */
export function buildScriptMap(input: BuildEditInput): ScriptSegment[] {
  const segments: ScriptSegment[] = [];
  const fullScript = (input.script ?? "").trim();

  if (fullScript) {
    let offset = 0;
    for (const para of splitScriptParagraphs(fullScript)) {
      for (const sentence of splitSentences(para)) {
        const charStart = fullScript.indexOf(sentence, offset);
        const charEnd = charStart >= 0 ? charStart + sentence.length : undefined;
        if (charStart >= 0) offset = charEnd ?? offset;

        segments.push({
          id: `script-${segments.length}`,
          text: sentence,
          shotIndex: matchSentenceToShot(sentence, input),
          charStart: charStart >= 0 ? charStart : undefined,
          charEnd,
          source: "script",
        });
      }
    }
  }

  if (segments.length === 0) {
    return buildShotFirstScriptMap(input);
  }

  return segments;
}

/** 根据 video 时间轴填充 scriptMap 的时间位置 */
export function attachTimelineToScriptMap(
  scriptMap: ScriptSegment[],
  videoClips: { sourceKey: string; startSec: number; durationSec: number; video?: { shotIndex: number } }[]
): ScriptSegment[] {
  const shotStart = new Map<number, number>();
  for (const clip of videoClips) {
    const idx = clip.video?.shotIndex;
    if (idx !== undefined && !shotStart.has(idx)) {
      shotStart.set(idx, clip.startSec);
    }
  }

  return scriptMap.map((seg) => {
    if (seg.shotIndex === undefined) return seg;
    const start = shotStart.get(seg.shotIndex);
    return start !== undefined ? { ...seg, timelineStartSec: start } : seg;
  });
}
