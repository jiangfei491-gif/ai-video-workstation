/**
 * AI Intelligence Center（AI 技术情报中心）—— 统一类型与架构声明
 * 职责：发现 / 分析 / 推荐 / 升级 所有 AI 新技术。
 * 本阶段仅架构，不接任何 API、不抓数据、不请求第三方。
 */

/** 10 个平台 Center */
export type IcPlatformId =
  | "github"
  | "huggingface"
  | "modelscope"
  | "pypi"
  | "npm"
  | "arxiv"
  | "ai-news"
  | "comfyui"
  | "mcp"
  | "ai-video";

/** 统一状态机 */
export type IcStatus =
  | "pending" // 等待
  | "crawling" // 抓取中
  | "analyzing" // 分析中
  | "review" // 待审核
  | "approved" // 已通过
  | "rejected" // 已拒绝
  | "installing" // 安装中
  | "installed" // 安装完成
  | "failed"; // 失败

export const IC_STATUS_LABEL: Record<IcStatus, string> = {
  pending: "等待",
  crawling: "抓取中",
  analyzing: "分析中",
  review: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  installing: "安装中",
  installed: "安装完成",
  failed: "失败",
};

/** 每个 Center 的 8 个子模块 */
export type IcSubModule =
  | "sources"
  | "analyzer"
  | "advisor"
  | "review"
  | "history"
  | "settings";

export const IC_SUBMODULES: { id: IcSubModule; label: string }[] = [
  { id: "sources", label: "订阅源" },
  { id: "analyzer", label: "分析" },
  { id: "advisor", label: "升级顾问" },
  { id: "review", label: "审核队列" },
  { id: "history", label: "历史" },
  { id: "settings", label: "设置" },
];

/** 平台定义 */
export interface IcPlatform {
  id: IcPlatformId;
  name: string;
  nameZh: string;
  category: string;
  description: string;
  /** 未来 Provider 的基址提示（本阶段仅记录，不请求） */
  apiHint?: string;
  /** 该平台发现的对象类型（repo / model / paper / package …） */
  entityKind: string;
}

/** 统一 Source（注册到 Source Registry，不写死） */
export interface IcSource {
  id: string;
  platformId: IcPlatformId;
  name: string;
  /** 使用哪个 Provider slug（统一 Crawler Framework 通过它调度） */
  providerSlug: string;
  /** 查询/订阅定义（如关键词、topic、作者、tag），本阶段仅存不跑 */
  query?: Record<string, unknown>;
  enabled: boolean;
  requiresToken: boolean;
  createdAt: string;
}

/** 抓取任务 */
export interface IcCrawlerTask {
  id: string;
  platformId: IcPlatformId;
  sourceId: string;
  status: IcStatus;
  itemsFound: number;
  error?: string | null;
  createdAt: string;
}

/** 抓到的一个候选项目/技术 */
export interface IcDiscoveredItem {
  id: string;
  platformId: IcPlatformId;
  externalId: string;
  title: string;
  url?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  discoveredAt: string;
}

/** 分析结果 */
export interface IcAnalyzerResult {
  id: string;
  itemId: string;
  model: string; // 默认 deepseek（本阶段不接模型）
  summary?: string;
  tags: string[];
  category?: string;
  /** 与 AI Video OS 的相关度 0-1 */
  relevance?: number;
  createdAt: string;
}

/** 升级建议 */
export interface IcUpgradeRecommendation {
  id: string;
  itemId: string;
  /** 建议接入哪个 AI Video OS 模块 */
  targetModule: string;
  /** 综合评分 0-100 */
  score: number;
  worthIntegrating: boolean;
  recommendation: string;
  createdAt: string;
}

/** 审核队列项 */
export interface IcReviewItem {
  id: string;
  recommendationId: string;
  /** 建议动作 */
  action: "add_project" | "upgrade_module" | "add_feature";
  status: Extract<IcStatus, "review" | "approved" | "rejected">;
  decidedBy?: string | null;
  createdAt: string;
}

/** 安装任务（Git Clone / 下载模型 / 插件 / Workflow）——本阶段不真正下载 */
export interface IcInstallTask {
  id: string;
  reviewItemId: string;
  kind: "git-clone" | "model" | "plugin" | "workflow";
  target: string;
  status: Extract<IcStatus, "pending" | "installing" | "installed" | "failed">;
  createdAt: string;
}

export interface IcLogEntry {
  id: string;
  platformId?: IcPlatformId;
  level: "info" | "warn" | "error";
  message: string;
  at: string;
}

export interface IcSettings {
  autoAdvise: boolean;
  requireHumanReview: boolean;
  defaultAnalyzerModel: string; // 便宜档打分模型，"deepseek" | "gemini-flash"
  useStrongReview: boolean; // 是否用强模型复核高分项
  strongModel: string; // 强档模型，"claude-sonnet" | "gpt-4.1"
  escalateMin: number; // 便宜档达到多少分才送强模型复核
  strongBudget: number; // 每次最多复核多少项
  minScoreToRecommend: number; // 自动加入审核的分数线：打分 ≥ 此值自动进审核队列
  autoEnqueue: boolean; // 自动打分后，达标项是否自动加入审核队列（免手动点）
  discoverPageSize: number; // 每次发现抓多少条
}

export const IC_DEFAULT_SETTINGS: IcSettings = {
  autoAdvise: true,
  requireHumanReview: true,
  defaultAnalyzerModel: "deepseek",
  useStrongReview: true,
  strongModel: "claude-sonnet",
  escalateMin: 60,
  strongBudget: 8,
  minScoreToRecommend: 60,
  autoEnqueue: true,
  discoverPageSize: 50,
};
