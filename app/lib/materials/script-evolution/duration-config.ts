/** 脚本进化 V2 — 时长 → 字数 / 章节 / 结构模板 */

export const DURATION_PRESETS_MINUTES = [0.5, 1, 3, 5, 8, 10, 15] as const;
export const MIN_DURATION_MINUTES = 0.5;
export const MAX_DURATION_MINUTES = 60;

const WORD_COUNT_TABLE: [number, number][] = [
  [0.5, 180],
  [1, 350],
  [3, 1000],
  [5, 1700],
  [8, 2800],
  [10, 3500],
  [15, 5200],
  [60, 20000],
];

const CHAPTER_COUNT_TABLE: [number, number][] = [
  [0.5, 1],
  [1, 2],
  [3, 4],
  [5, 6],
  [8, 8],
  [10, 10],
  [15, 15],
  [60, 20],
];

const CHAPTER_NUMERALS = [
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
  "十",
  "十一",
  "十二",
  "十三",
  "十四",
  "十五",
  "十六",
  "十七",
  "十八",
  "十九",
  "二十",
];

function interpolateTable(table: [number, number][], minutes: number): number {
  if (minutes <= table[0][0]) return table[0][1];
  if (minutes >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    if (minutes >= x0 && minutes <= x1) {
      const t = (minutes - x0) / (x1 - x0);
      return Math.round(y0 + (y1 - y0) * t);
    }
  }
  return table[0][1];
}

export function clampDurationMinutes(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const rounded = Math.round(value * 10) / 10;
  return Math.max(MIN_DURATION_MINUTES, Math.min(MAX_DURATION_MINUTES, rounded));
}

export function estimateWordCount(minutes: number): number {
  return interpolateTable(WORD_COUNT_TABLE, clampDurationMinutes(minutes));
}

export function estimateChapterCount(minutes: number): number {
  return Math.max(1, Math.min(20, interpolateTable(CHAPTER_COUNT_TABLE, minutes)));
}

export function videoFormatHint(minutes: number): string {
  if (minutes <= 1) return "适合短视频/Shorts";
  if (minutes <= 5) return "适合中短视频";
  if (minutes <= 10) return "适合中长视频";
  return "适合 YouTube 长视频";
}

export function buildStructureTemplate(minutes: number): string {
  const m = clampDurationMinutes(minutes);
  if (m <= 1) return "黄金3秒 → 故事 → 反转 → 结尾";
  if (m <= 3) return "黄金3秒 → 起 → 承 → 转 → 合";

  const chapters = estimateChapterCount(m);
  const bodyChapters = Math.max(1, chapters - 2);
  const parts: string[] = ["黄金3秒"];
  for (let i = 0; i < bodyChapters; i++) {
    parts.push(`第${CHAPTER_NUMERALS[i] ?? i + 1}章`);
  }
  parts.push("高潮", "结尾");
  return parts.join(" → ");
}

export type DurationPlan = {
  minutes: number;
  targetWordCount: number;
  chapterCount: number;
  structureTemplate: string;
  formatHint: string;
};

export function buildDurationPlan(minutes: number): DurationPlan {
  const m = clampDurationMinutes(minutes);
  return {
    minutes: m,
    targetWordCount: estimateWordCount(m),
    chapterCount: estimateChapterCount(m),
    structureTemplate: buildStructureTemplate(m),
    formatHint: videoFormatHint(m),
  };
}

export function buildDurationPromptBlock(plan: DurationPlan): string {
  return `请生成约 ${plan.minutes} 分钟脚本。预计 ${plan.targetWordCount} 字。章节数量 ${plan.chapterCount} 章。${plan.formatHint}。
故事结构：${plan.structureTemplate}`;
}

/** 粗算 V2 进化成本与耗时（供界面展示） */
export function estimateEvolutionMeta(
  minutes: number,
  providerCount: number
): { wordCount: number; chapters: number; seconds: number; costMin: number; costMax: number } {
  const plan = buildDurationPlan(minutes);
  const p = Math.max(1, providerCount);
  const outlineCost = p * 2 * 0.15;
  const outlineScoreCost = 8 * 0.05;
  const expandCost = 2 * (0.5 + plan.minutes * 0.4);
  const finalScoreCost = 2 * p * 0.12;
  const costMin = Math.round((outlineCost + outlineScoreCost + expandCost + finalScoreCost) * 10) / 10;
  const costMax = Math.round(costMin * 2.2 * 10) / 10;
  const seconds = 20 + p * 8 + Math.round(plan.minutes * 4);
  return {
    wordCount: plan.targetWordCount,
    chapters: plan.chapterCount,
    seconds,
    costMin,
    costMax,
  };
}
