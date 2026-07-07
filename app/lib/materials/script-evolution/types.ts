/** 脚本进化引擎 — 类型定义 */

export type ScriptProviderId = "gpt" | "claude" | "gemini" | "deepseek";

export type ScriptStyleId = "documentary" | "cinematic" | "suspense" | "viral";

export const SCRIPT_STYLES: {
  id: ScriptStyleId;
  label: string;
  hint: string;
}[] = [
  { id: "documentary", label: "纪录片风", hint: "冷静纪实、时间线清晰、尊重事实" },
  { id: "cinematic", label: "电影风", hint: "画面感强、镜头语言、情绪张力" },
  { id: "suspense", label: "悬疑风", hint: "层层反转、悬念钩子、节奏紧凑" },
  { id: "viral", label: "爆款风", hint: "前三秒抓人、口语化、适合短视频传播" },
];

/** 脚本进化：4 种风格完全随机分配 */
export const ALL_STYLE_IDS: ScriptStyleId[] = SCRIPT_STYLES.map((s) => s.id);

/** @deprecated V2 使用 ALL_STYLE_IDS 随机 */
export const EVOLUTION_STYLE_IDS: ScriptStyleId[] = ["documentary", "viral"];

export const SCRIPT_PROVIDERS: {
  id: ScriptProviderId;
  label: string;
}[] = [
  { id: "claude", label: "Claude（内容中心默认）" },
  { id: "gpt", label: "GPT" },
  { id: "gemini", label: "Gemini" },
  { id: "deepseek", label: "DeepSeek" },
];

export type ScriptScores = {
  authenticity: number;
  storytelling: number;
  suspense: number;
  emotion: number;
  informationDensity: number;
  completionRatePredict: number;
  commentRatePredict: number;
  shareRatePredict: number;
  total: number;
};

/** V2 长文评分维度 */
export type FullScriptScores = ScriptScores & {
  hookStrength: number;
  pacing: number;
  characterDepth: number;
  logic: number;
  originality: number;
  aiTaste: number;
  durationFit: number;
  ctrPredict: number;
};

export type JudgeScoreEntry = {
  judgeProvider: ScriptProviderId;
  scores: FullScriptScores;
  total: number;
  brief: string;
  deductReasons?: string;
};

export type TruthViolation = {
  segment: string;
  issue: string;
};

export type TruthReport = {
  authenticityScore: number;
  violations: TruthViolation[];
  summary: string;
};

export type ViralReport = {
  completionRatePredict: number;
  hookStrength: number;
  suspenseAt10s: number;
  infoEvery30s: number;
  commentTrigger: number;
  summary: string;
};

export type OutlineCandidate = {
  id: string;
  provider: ScriptProviderId;
  style: ScriptStyleId;
  model: string;
  outline: string;
  judgeProvider?: ScriptProviderId;
  scores?: ScriptScores;
  totalScore?: number;
  brief?: string;
};

export type ScriptCandidate = {
  id: string;
  provider: ScriptProviderId;
  style: ScriptStyleId;
  model: string;
  script: string;
  outline?: string;
  outlineId?: string;
  judgeProvider?: ScriptProviderId;
  scores?: ScriptScores;
  truthReport?: TruthReport;
  viralReport?: ViralReport;
  totalScore?: number;
  judgeScores?: JudgeScoreEntry[];
  aggregatedScore?: number;
  eliminated?: boolean;
  eliminatedAtRound?: number;
};

export type TournamentRound = {
  round: number;
  label: string;
  survivorIds: string[];
  eliminatedIds: string[];
};

export type EvolutionRun = {
  id: string;
  materialId: string;
  materialTitle: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  stage: string;
  version: "v2";
  durationMinutes: number;
  targetWordCount: number;
  chapterCount: number;
  structureTemplate: string;
  outlines: OutlineCandidate[];
  candidates: ScriptCandidate[];
  rounds: TournamentRound[];
  championId?: string;
  runnerUpId?: string;
  championScript?: string;
  runnerUpScript?: string;
  /** @deprecated 使用 championId / runnerUpId */
  topScriptIds?: string[];
  usage?: import("./evolution-usage").EvolutionUsageSummary;
  scriptRecordIds?: string[];
  error?: string;
};

export type EvolutionStage =
  | "outline-generate"
  | "outline-score"
  | "expand"
  | "final-score"
  | "done";

/** P8：局部重写模式 */
export type ScriptRewriteMode =
  | "opening"
  | "climax"
  | "ending"
  | "suspense"
  | "emotion"
  | "authenticity"
  | "completion";

export const SCRIPT_REWRITE_MODES: {
  id: ScriptRewriteMode;
  label: string;
  hint: string;
}[] = [
  { id: "opening", label: "重写开头", hint: "前三秒更强钩子，其余尽量保留" },
  { id: "climax", label: "重写高潮", hint: "强化高潮段，前后衔接自然" },
  { id: "ending", label: "重写结尾", hint: "结尾更有余韵或促进评论" },
  { id: "suspense", label: "提高悬念", hint: "全篇悬念节奏上调" },
  { id: "emotion", label: "提高情绪", hint: "情绪张力与感染力上调" },
  { id: "authenticity", label: "提高真实性", hint: "删捏造、贴素材事实" },
  { id: "completion", label: "提高完播率", hint: "节奏与信息密度利于看完" },
];

/** 脚本数据库 — 单次进化产物归档 */
export type ScriptRecordRole = "champion" | "runner-up" | "finalist" | "outline";

export type YoutubeMetrics = {
  views?: number;
  completionRate?: number;
  ctr?: number;
  commentRate?: number;
  shareRate?: number;
  updatedAt?: string;
};

export type ScriptRecord = {
  id: string;
  evolutionRunId: string;
  materialId: string;
  materialTitle: string;
  category: string;
  role: ScriptRecordRole;
  provider: ScriptProviderId;
  style: ScriptStyleId;
  model: string;
  durationMinutes: number;
  targetWordCount: number;
  actualWordCount: number;
  outline?: string;
  script?: string;
  outlineId?: string;
  rank?: number;
  aggregatedScore?: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costCny: number;
  generationMs: number;
  createdAt: string;
  selectedForPublish: boolean;
  published: boolean;
  publishedAt?: string;
  videoUrl?: string;
  youtubeMetrics?: YoutubeMetrics;
  humanScore?: number;
  humanNote?: string;
};

/** 评分数据库 — 每次裁判打分独立存档 */
export type ScoreRecordTargetType = "outline" | "full-script";

export type ScoreRecord = {
  id: string;
  evolutionRunId: string;
  materialId: string;
  category: string;
  targetId: string;
  targetType: ScoreRecordTargetType;
  generatorProvider: ScriptProviderId;
  style: ScriptStyleId;
  judgeProvider: ScriptProviderId;
  judgeModel?: string;
  scores: ScriptScores | FullScriptScores;
  total: number;
  rank?: number;
  deductReasons?: string;
  brief?: string;
  createdAt: string;
};

export type ModelPerformanceEntry = {
  provider: ScriptProviderId;
  modelVersion: string;
  totalRuns: number;
  outlineRuns: number;
  outlineAvg: number;
  fullRuns: number;
  fullAvg: number;
  championCount: number;
  runnerUpCount: number;
  top3Count: number;
  winRate: number;
  expandWinRate: number;
  avgDurationMs: number;
  avgTokens: number;
  avgCostUsd: number;
  judgeConsistency: number;
  categoryAvgs: Record<string, number>;
  styleAvgs: Record<string, number>;
};

export type StylePerformanceEntry = {
  style: ScriptStyleId;
  useCount: number;
  outlineAvg: number;
  fullAvg: number;
  championCount: number;
  runnerUpCount: number;
  winRate: number;
  avgCompletionPredict: number;
  bestProvider?: ScriptProviderId;
  bestCategory?: string;
};

export type EvolutionRecommendation = {
  provider: ScriptProviderId;
  style: ScriptStyleId;
  reason: string;
  confidence: number;
};
