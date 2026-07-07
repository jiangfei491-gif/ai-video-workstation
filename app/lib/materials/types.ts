export const MATERIAL_CATEGORIES = [
  "故事",
  "历史",
  "悬疑",
  "财富",
  "战争",
  "科技",
  "未解之谜",
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

/** Agent 抓取素材的目标语言（界面文案仍为中文） */
export const MATERIAL_LANGUAGES = [
  { id: "zh", label: "中文" },
  { id: "en", label: "英文" },
  { id: "ja", label: "日文" },
  { id: "ko", label: "韩文" },
  { id: "es", label: "西班牙文" },
  { id: "de", label: "德文" },
  { id: "fr", label: "法文" },
  { id: "pt", label: "葡萄牙文" },
  { id: "ru", label: "俄文" },
  { id: "ar", label: "阿拉伯文" },
] as const;

export type MaterialLanguage = (typeof MATERIAL_LANGUAGES)[number]["id"];

/** Agent 搜索时可不限单一语种 */
export const MATERIAL_SEARCH_LANGUAGE_ALL = "all" as const;
export type MaterialSearchLanguage =
  | MaterialLanguage
  | typeof MATERIAL_SEARCH_LANGUAGE_ALL;

/** Agent 搜索时可不限单一分类 */
export const MATERIAL_CATEGORY_ALL = "全部" as const;

export const MATERIAL_SEARCH_LANGUAGES = [
  { id: MATERIAL_SEARCH_LANGUAGE_ALL, label: "全部" },
  ...MATERIAL_LANGUAGES,
] as const;

export const MATERIAL_SEARCH_CATEGORIES = [
  MATERIAL_CATEGORY_ALL,
  ...MATERIAL_CATEGORIES,
] as const;

export function isMaterialLanguage(value: string): value is MaterialLanguage {
  return MATERIAL_LANGUAGES.some((l) => l.id === value);
}

export function isMaterialSearchLanguage(
  value: string
): value is MaterialSearchLanguage {
  return value === MATERIAL_SEARCH_LANGUAGE_ALL || isMaterialLanguage(value);
}

export function resolveMaterialLanguage(value?: string): MaterialLanguage {
  return value && isMaterialLanguage(value) ? value : "zh";
}

export function resolveMaterialSearchLanguage(
  value?: string
): MaterialSearchLanguage {
  if (value === MATERIAL_SEARCH_LANGUAGE_ALL) return MATERIAL_SEARCH_LANGUAGE_ALL;
  return resolveMaterialLanguage(value);
}

export function resolveMaterialSearchCategory(value?: string): string {
  const v = value?.trim();
  if (!v || v === MATERIAL_CATEGORY_ALL) return MATERIAL_CATEGORY_ALL;
  if ((MATERIAL_CATEGORIES as readonly string[]).includes(v)) return v;
  return MATERIAL_CATEGORIES[0];
}

export function resolveFoundMaterialCategory(
  itemCategory: string | undefined,
  searchCategory: string
): string {
  const c = itemCategory?.trim();
  if (c && (MATERIAL_CATEGORIES as readonly string[]).includes(c)) return c;
  if (searchCategory !== MATERIAL_CATEGORY_ALL) return searchCategory;
  return MATERIAL_CATEGORIES[0];
}

export function resolveFoundMaterialLanguage(
  itemLanguage: string | undefined,
  searchLanguage: MaterialSearchLanguage
): MaterialLanguage | undefined {
  if (itemLanguage && isMaterialLanguage(itemLanguage)) return itemLanguage;
  if (searchLanguage !== MATERIAL_SEARCH_LANGUAGE_ALL) return searchLanguage;
  return undefined;
}

export function getMaterialLanguageLabel(id: MaterialLanguage): string {
  return MATERIAL_LANGUAGES.find((l) => l.id === id)?.label ?? id;
}

export function getMaterialSearchLanguageLabel(id: MaterialSearchLanguage): string {
  if (id === MATERIAL_SEARCH_LANGUAGE_ALL) return "全部";
  return getMaterialLanguageLabel(id);
}

/** 找素材联网搜索模型：全部=GPT 优先、失败自动切换 Gemini */
export const MATERIAL_SEARCH_PROVIDER_ALL = "all" as const;
export type MaterialSearchProviderChoice =
  | typeof MATERIAL_SEARCH_PROVIDER_ALL
  | "gpt"
  | "gemini";

export const MATERIAL_SEARCH_PROVIDER_OPTIONS = [
  { id: MATERIAL_SEARCH_PROVIDER_ALL, label: "全部" },
  { id: "gpt", label: "GPT" },
  { id: "gemini", label: "Gemini" },
] as const;

export function isMaterialSearchProviderChoice(
  value: string
): value is MaterialSearchProviderChoice {
  return (
    value === MATERIAL_SEARCH_PROVIDER_ALL || value === "gpt" || value === "gemini"
  );
}

export function resolveMaterialSearchProvider(
  value?: string
): MaterialSearchProviderChoice {
  if (value && isMaterialSearchProviderChoice(value)) return value;
  return MATERIAL_SEARCH_PROVIDER_ALL;
}

export function getMaterialSearchProviderLabel(id: MaterialSearchProviderChoice): string {
  return MATERIAL_SEARCH_PROVIDER_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

/** 非中文素材的原文语言备注，如「原文：英文」 */
export function formatMaterialLanguageNote(language?: MaterialLanguage): string | null {
  if (!language || language === "zh") return null;
  return `原文：${getMaterialLanguageLabel(language)}`;
}

export type MaterialStatus = "待分析" | "已分析" | "已生成脚本" | "已生成视频";

export type { ContentType } from "./truth-lock";
export {
  CONTENT_TYPES,
  contentTypeFromCategory,
  defaultLockFieldsForCategory,
  formatSafetyLevelLabel,
  getMaterialLockFields,
} from "./truth-lock";

/** AI 结构化分析（对应 material_analysis 表） */
export type MaterialAnalysis = {
  summary: string;
  characters: string;
  location: string;
  timeline: string;
  conflict: string;
  twist: string;
  climax: string;
  ending: string;
  emotion: string;
  /** 视频潜力评分 0-10 */
  score: number;
  tags: string[];
  /** 适合：长视频 / Shorts / 纪录片 / 动画故事 */
  suitability: string[];
  /** 推荐赛道：故事 / 历史 / 悬疑 … */
  tracks: string[];
};

/** 脚本（对应 scripts 表） */
export type MaterialScript = {
  id: string;
  title: string;
  script: string;
  duration?: number;
  language?: string;
  createdAt: string;
};

/** 原始素材（对应 materials 表；分析与脚本内嵌，便于本地 JSON 存储） */
export type Material = {
  id: string;
  title: string;
  content: string;
  source: string;
  url: string;
  category: string;
  /** 原文语言（Agent 抓取时写入，用于备注；入库标题/正文统一中文） */
  language?: MaterialLanguage;
  /** 方案一：入库时按分类写入的锁字段 */
  contentType?: import("./truth-lock").ContentType;
  truthLock?: number;
  allowSpeculation?: boolean;
  allowDialogue?: boolean;
  allowFiction?: boolean;
  forbidNewCharacters?: boolean;
  forbidNewEvents?: boolean;
  forbidChangeEnding?: boolean;
  status: MaterialStatus;
  favorite: boolean;
  createdAt: string;
  analysis?: MaterialAnalysis;
  scripts: MaterialScript[];
};
