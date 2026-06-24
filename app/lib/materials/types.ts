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

export type MaterialStatus = "待分析" | "已分析" | "已生成脚本" | "已生成视频";

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
  status: MaterialStatus;
  favorite: boolean;
  createdAt: string;
  analysis?: MaterialAnalysis;
  scripts: MaterialScript[];
};
