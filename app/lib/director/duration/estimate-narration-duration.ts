/**
 * Narration Duration Estimator (Phase 2) —— 事前(TTS 前)旁白时长估算。
 *
 * ⚠️ PLANNING ESTIMATE ONLY：这是**规划用**的确定性估算，不是真实语音时长。
 * 真实 TTS 后仍以 ffprobe / provider 返回的 voiceDuration 为准（见 extendVideoToVoiceDuration 的 Math.max）。
 * 本估算**不进入 Subtitle Center**（字幕 timing 仍来自 Whisper/provider timestamps）。
 *
 * 纯函数：不读 workbench、不调 Provider/TTS/ffprobe、deterministic。
 */

export type LanguageMode = "empty" | "cjk" | "latin" | "mixed";

export type NarrationDurationEstimate = {
  /** 估算语音时长（秒），空文本=0 */
  durationSec: number;
  /** 计量单位数：CJK 字数 + 英文词数 + 数字组 */
  textUnitCount: number;
  languageMode: LanguageMode;
  /** 估算来源标记，永远是 planning baseline，非真实 voice */
  rateSource: "planning-baseline";
};

export type NarrationDurationEstimateOptions = {
  /** 中文/CJK 语速：字/秒（NORMAL baseline 5.5，来自 Phase 2 preflight simulation） */
  cjkCharsPerSec?: number;
  /** 英文/Latin 语速：词/分钟（NORMAL baseline 150） */
  latinWordsPerMin?: number;
};

/** 语速常量集中定义（禁止散落 magic number）。默认代表 NORMAL narration。 */
export const NARRATION_RATE = {
  cjkCharsPerSec: 5.5,
  latinWordsPerMin: 150,
} as const;

// CJK 表意文字 + 假名（发声计时单位）；不含标点/空白 → 标点空白不造成膨胀
const CJK_RE = /[㐀-䶿一-鿿豈-﫿぀-ヿ]/g;
// 英文词（含撇号/连字符内部）
const LATIN_WORD_RE = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
// 数字组（每组约按一个词计时）
const DIGIT_GROUP_RE = /\d+(?:[.,]\d+)*/g;

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/**
 * 估算一段旁白文本的朗读时长（PLANNING ESTIMATE）。
 * 中英混排：分别按各自语速估算后相加。
 */
export function estimateNarrationDurationSec(
  text: string,
  options?: NarrationDurationEstimateOptions
): NarrationDurationEstimate {
  const t = (text ?? "").trim();
  if (!t) {
    return { durationSec: 0, textUnitCount: 0, languageMode: "empty", rateSource: "planning-baseline" };
  }
  const cjkPerSec = options?.cjkCharsPerSec ?? NARRATION_RATE.cjkCharsPerSec;
  const latinWpm = options?.latinWordsPerMin ?? NARRATION_RATE.latinWordsPerMin;

  const cjkChars = (t.match(CJK_RE) ?? []).length;
  const latinWords = (t.match(LATIN_WORD_RE) ?? []).length;
  const digitGroups = (t.match(DIGIT_GROUP_RE) ?? []).length;

  const cjkSec = cjkChars / cjkPerSec;
  const latinSec = (latinWords + digitGroups) / (latinWpm / 60);
  const durationSec = round3(cjkSec + latinSec);

  const hasCjk = cjkChars > 0;
  const hasLatin = latinWords + digitGroups > 0;
  const languageMode: LanguageMode =
    hasCjk && hasLatin ? "mixed" : hasCjk ? "cjk" : "latin";

  return {
    durationSec,
    textUnitCount: cjkChars + latinWords + digitGroups,
    languageMode,
    rateSource: "planning-baseline",
  };
}
