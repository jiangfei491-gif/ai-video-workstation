import { emptyTokenLine, mergeTokenLine } from "@/app/lib/cost-ledger/merge";
import type { TokenCostLine } from "@/app/lib/cost-ledger/types";
import type { DirectorStoryboardShot } from "@/app/lib/director/types";
import { analyzeNarrativeBeats } from "./analyze-beats";
import { splitBeatRuleFallback, splitNarrativeShots } from "./generate-shots";
import type { BeatSplitDiagnostics, NarrativeBeat, NarrativeShot } from "./types";
import { computeBeatSplitDiagnostics } from "./validate-beat-split";
import { shotIdFromIndex } from "@/app/lib/shared/shot-id";

export type GenerateNarrativeStoryboardOptions = {
  targetDurationMinutes?: number;
  shotDurationSec?: number;
  ruleOnly?: boolean;
};

export type GenerateNarrativeStoryboardResult = {
  storyboard: DirectorStoryboardShot[];
  beats: NarrativeBeat[];
  narrativeShots: NarrativeShot[];
  usage: TokenCostLine;
  splitDiagnostics: BeatSplitDiagnostics;
};

export function narrativeShotToStoryboard(shot: NarrativeShot): DirectorStoryboardShot {
  return {
    shotId: shot.shotId,
    beatId: shot.beatId,
    sceneNumber: shot.sceneNumber,
    duration: shot.duration,
    character: shot.character,
    action: shot.action,
    reaction: shot.reaction,
    environment: shot.environment,
    camera: shot.camera,
    visualFocus: shot.visualFocus,
    shotPurpose: shot.shotPurpose,
    narration: shot.narration,
    narrationRef: shot.narrationRef,
    transition: shot.transition,
  };
}

/** 规则 Beat：按章节/大段落合并为完整微型剧情单元 */
export function analyzeBeatsRuleFallback(script: string): NarrativeBeat[] {
  const lines = script.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const beats: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;

  const isChapter = (line: string) =>
    /^第[一二三四五六七八九十\d]+章/.test(line) || /^结尾/.test(line);

  for (const line of lines) {
    if (isChapter(line)) {
      if (current?.lines.length) beats.push(current);
      current = { title: line, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    } else {
      current = { title: "开篇", lines: [line] };
    }
  }
  if (current?.lines.length) beats.push(current);

  if (beats.length <= 1) {
    const blocks = script
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter(Boolean);
    const merged: string[] = [];
    let buf = "";
    for (const b of blocks) {
      buf = buf ? `${buf}\n\n${b}` : b;
      if (buf.length >= 280 || /。.*。/.test(buf)) {
        merged.push(buf);
        buf = "";
      }
    }
    if (buf) merged.push(buf);
    return merged.map((sourceText, i) => ({
      beatId: `BEAT_${String(i + 1).padStart(3, "0")}`,
      sourceText,
      beatGoal: sourceText.slice(0, 48).replace(/\n/g, " "),
      narrativePurpose: "叙事过程",
      characters: [],
      environment: "未指定",
      emotionalState: "中性",
      informationChange: "推进叙事",
      estimatedNarrationWeight: 1 / Math.max(merged.length, 1),
      narration: sourceText,
    }));
  }

  return beats.map((b, i) => {
    const sourceText = b.lines.join("\n");
    return {
      beatId: `BEAT_${String(i + 1).padStart(3, "0")}`,
      sourceText,
      beatGoal: b.title,
      narrativePurpose: b.title,
      characters: sourceText.includes("木村") ? ["木村秋则"] : [],
      environment: /果园|仓库|集市|东京/.test(sourceText)
        ? (sourceText.match(/(果园|仓库|集市|东京)/)?.[1] ?? "未指定")
        : "未指定",
      emotionalState: /震惊|希望|绝望|奇迹|坚持/.test(sourceText) ? "情绪转折" : "中性",
      informationChange: "推进本章叙事",
      estimatedNarrationWeight: 1 / beats.length,
      narration: sourceText,
    };
  });
}

export async function generateNarrativeStoryboard(
  title: string,
  script: string,
  options?: GenerateNarrativeStoryboardOptions
): Promise<GenerateNarrativeStoryboardResult> {
  const ruleOnly = options?.ruleOnly ?? false;

  const beatResult = ruleOnly
    ? { beats: analyzeBeatsRuleFallback(script), usage: emptyTokenLine() }
    : await analyzeNarrativeBeats({
        title,
        script,
        targetDurationMinutes: options?.targetDurationMinutes,
      });

  const shotResult = await splitNarrativeShots({
    title,
    beats: beatResult.beats,
    defaultDuration: options?.shotDurationSec ?? 6,
    ruleOnly,
  });

  const storyboard = shotResult.shots.map(narrativeShotToStoryboard);
  const usage = mergeTokenLine(beatResult.usage, shotResult.usage);

  return {
    storyboard,
    beats: shotResult.beats,
    narrativeShots: shotResult.shots,
    usage,
    splitDiagnostics: shotResult.splitDiagnostics,
  };
}

/** @deprecated 使用 generateNarrativeStoryboard({ ruleOnly: true }) */
export function generateNarrativeStoryboardRuleFallback(
  title: string,
  script: string,
  options?: Omit<GenerateNarrativeStoryboardOptions, "ruleOnly">
): GenerateNarrativeStoryboardResult {
  void title;
  const beats = analyzeBeatsRuleFallback(script);
  const duration = options?.shotDurationSec ?? 6;
  const enrichedBeats: NarrativeBeat[] = [];
  const rawAll: NarrativeShot[] = [];
  let idx = 0;

  for (const beat of beats) {
    const part = splitBeatRuleFallback(beat);
    enrichedBeats.push(part.beat);
    for (const s of part.shots) {
      rawAll.push({
        ...s,
        shotId: shotIdFromIndex(idx++),
        sceneNumber: idx,
        duration,
      });
    }
  }

  return {
    storyboard: rawAll.map(narrativeShotToStoryboard),
    beats: enrichedBeats,
    narrativeShots: rawAll,
    usage: emptyTokenLine(),
    splitDiagnostics: computeBeatSplitDiagnostics(enrichedBeats, rawAll),
  };
}
