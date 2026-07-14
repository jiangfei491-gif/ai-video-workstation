/** 音乐歌词模块（最终版）— 仅公版歌词 + 原创歌词 */

/** 一级菜单 */
export type MusicSubModule = "public-lyrics" | "original-lyrics";

export const MUSIC_SUBMODULE_LABEL: Record<MusicSubModule, string> = {
  "public-lyrics": "公版歌词",
  "original-lyrics": "原创歌词",
};

/** 公版入库最低综合分 */
export const MIN_PUBLIC_OVERALL_SCORE = 80;

/** 主题分类（GPT 自动分类 · 单选） */
export const PUBLIC_CATEGORIES = [
  "爱情",
  "友情",
  "家庭",
  "梦想",
  "成长",
  "励志",
  "人生",
  "战争",
  "自然",
  "信仰",
  "儿童",
  "节日",
  "其它",
] as const;
export type PublicCategory = (typeof PUBLIC_CATEGORIES)[number];

/** 情绪标签 */
export const MOOD_TAGS = [
  "快乐",
  "悲伤",
  "怀旧",
  "浪漫",
  "治愈",
  "激昂",
  "孤独",
  "希望",
  "神秘",
] as const;

/** 场景标签 */
export const SCENE_TAGS = [
  "学习",
  "睡眠",
  "旅行",
  "婚礼",
  "聚会",
  "儿童",
  "节日",
  "放松",
  "背景音乐",
  "其它",
] as const;

/** 风格标签 */
export const STYLE_TAGS = [
  "民谣",
  "乡村",
  "福音",
  "圣诗",
  "流行",
  "古典",
  "布鲁斯",
  "爵士",
  "传统",
] as const;

/** @deprecated 主题已合并到 category，保留常量供旧数据兼容 */
export const THEME_TAGS = PUBLIC_CATEGORIES;

/** 商业价值标签 */
export const COMMERCIAL_TAGS = [
  "现代仍流行",
  "热门翻唱",
  "经典名曲",
  "全球传播",
  "适合AI改编",
  "适合现代流行改编",
  "适合影视配乐",
  "适合短视频",
  "适合YouTube",
  "适合儿童频道",
  "适合睡眠频道",
  "适合治愈频道",
  "适合励志频道",
  "适合背景音乐",
  "高商业价值",
  "高改编价值",
  "高传播价值",
] as const;

/** 现代翻唱热度星级 */
export const COVER_HOTNESS_LEVELS = [
  "★★★★★",
  "★★★★☆",
  "★★★☆☆",
  "★★☆☆☆",
  "★☆☆☆☆",
] as const;
export type CoverHotnessLevel = (typeof COVER_HOTNESS_LEVELS)[number];

export type PublicLyricScores = {
  commercialValue: number;
  internationalFame: number;
  coverHotness: number;
  modernSpread: number;
  adaptationPotential: number;
  aiCompositionFit: number;
  storyRichness: number;
  emotionalRichness: number;
  lyricQuality: number;
  melodyAdaptation: number;
  contentCreationPotential: number;
  overall: number;
};

export type CoverHotnessAnalysis = {
  stars: CoverHotnessLevel | string;
  stillCoveredBySingers: boolean;
  stillOnYoutube: boolean;
  stillOnStreamingPlatforms: boolean;
  usedInFilmTvAnimeGames: boolean;
  globalSpreadAbility: boolean;
  commercialAdaptationValue: boolean;
  suitableForAiRecreation: boolean;
  includeReason: string;
  excludeReason: string;
};

export type StorageCategory =
  | "sources"
  | "parsed"
  | "public"
  | "original"
  | "evidence"
  | "versions"
  | "screenshots"
  | "logs";

export type PublicLyric = {
  id: string;
  workspaceId: string;
  title: string;
  titleZh: string;
  author: string;
  birthYear?: number;
  deathYear?: number;
  country: string;
  language: string;
  firstPublished: string;
  sourceUrl: string;
  category: string;
  moodTags: string[];
  sceneTags: string[];
  styleTags: string[];
  themeTags: string[];
  commercialTags: string[];
  overallScore: number;
  coverHotness: string;
  scoreDetails?: PublicLyricScores & { coverAnalysis?: CoverHotnessAnalysis };
  contentPreview: string;
  lyricZhRemark: string;
  contentFileId?: string;
  rawHtmlFileId?: string;
  syncedBy: string;
  createdAt: string;
  updatedAt: string;
  body?: string;
};

export type OriginalPrompt = {
  theme?: string;
  language?: string;
  style?: string;
  mood?: string;
  keywords?: string;
  length?: string;
  extra?: string;
};

export type OriginalLyric = {
  id: string;
  workspaceId: string;
  title: string;
  titleZh: string;
  language: string;
  prompt: OriginalPrompt;
  contentPreview: string;
  lyricZhRemark: string;
  contentFileId?: string;
  currentVersionId?: string;
  createdAt: string;
  updatedAt: string;
  body?: string;
};

export type OriginalVersion = {
  id: string;
  lyricId: string;
  versionNo: number;
  note: string;
  contentPreview: string;
  contentFileId?: string;
  createdBy: string;
  createdAt: string;
};

export type SyncRun = {
  id: string;
  trigger: string;
  status: string;
  foundCount: number;
  addedCount: number;
  skippedCount: number;
  failedCount: number;
  model: string;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
};

export type SeedSourceType = "wikipedia" | "hymnary" | "wikisource" | "other";

/** 用户粘贴导入的待入库曲目 */
export type MusicSeedTrack = {
  id: string;
  title: string;
  author: string;
  category: PublicCategory;
  styleTags: string[];
  language: string;
  deathYear?: number;
  sourceUrl: string;
  sourceType: SeedSourceType;
  priority: number;
  note: string;
};

export type SeedProgress = {
  total: number;
  pending: number;
  ingested: number;
  failed: number;
  rejected: number;
  skipped: number;
};

export type MusicSettings = {
  lastSyncAt?: string;
};

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = {};

/** 判断是否为中文歌词 */
export function isChineseLanguage(lang?: string): boolean {
  const l = (lang ?? "").trim().toLowerCase();
  return l === "zh" || l === "中文" || l.startsWith("zh-") || l.includes("chinese");
}
