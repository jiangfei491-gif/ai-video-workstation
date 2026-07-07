/**
 * AI Intelligence Center —— 统一入口（架构层）
 * 本阶段仅架构，不接 API、不抓数据、不请求第三方。
 */
export * from "./types";
export { IC_PLATFORMS, IC_PLATFORM_BY_ID, IC_PLATFORM_IDS } from "./platforms";

// Source Registry
export {
  registerIcSource,
  listIcSources,
  getIcSource,
  removeIcSource,
  countIcSources,
} from "./source-registry";

// Crawler Framework + Provider 架构
export type { IcProvider } from "./crawler/provider";
export { createPlaceholderProvider } from "./crawler/provider";
export {
  registerIcProvider,
  getIcProvider,
  getIcProviderForPlatform,
  listIcProviders,
} from "./crawler/registry";
export { getIcCrawlerFramework, IcCrawlerFramework } from "./crawler/framework";

// Analyzer + 级联打分
export type { IcAnalyzer } from "./analyzer/analyzer";
export { getIcAnalyzer, LlmAnalyzer, scoredToAnalysis, scoredToRecommendation } from "./analyzer/analyzer";
export { scoreItems } from "./analyzer/scorer";
export type { IcScoredItem, IcScoreRun, IcScoreOptions } from "./analyzer/scorer";
export { IC_MODELS, listIcModels } from "./analyzer/models";
export type { IcModelId } from "./analyzer/models";

// Upgrade Advisor
export type { IcAdvisor } from "./upgrade-advisor/advisor";
export { getIcAdvisor, PlaceholderAdvisor, AI_VIDEO_OS_MODULES } from "./upgrade-advisor/advisor";

// Review Queue（持久化 + 审核 + 安装）
export {
  enqueueReview,
  listReview,
  approveReview,
  rejectReview,
  enqueueScored,
  listReviewRecords,
  approveRecord,
  rejectRecord,
  installRecord,
} from "./review-queue/queue";
export type { EnqueueInput } from "./review-queue/queue";
export type { IcReviewRecord, IcReviewStatus, IcReviewAction, IcInstallState } from "./review-queue/store";

// Installer
export type { IcInstaller } from "./installer/installer";
export { getIcInstaller, RealInstaller } from "./installer/installer";
export { deriveInstall, installDestFor, installsRoot } from "./installer/git-install";

// 事件日志（History + Logs）
export { logEvent, listEvents } from "./event-log/store";
export type { IcEvent, IcEventKind, IcEventLevel, IcEventFilter } from "./event-log/store";

// 设置
export { getSettings, updateSettings } from "./settings/store";

// 订阅源 + 自动抓取
export {
  listSavedSources,
  getSavedSource,
  createSavedSource,
  updateSavedSource,
  removeSavedSource,
} from "./sources/store";
export type { IcSavedSource, CreateSourceInput } from "./sources/store";
export { addDiscoveries, listDiscoveries, attachScores } from "./discoveries/store";
export type { IcStoredDiscovery } from "./discoveries/store";
export { seedDefaultSources, buildPresets } from "./sources/presets";
export {
  getPlatformModules,
  getModuleNames,
  getPlatformStack,
  getQueryTerms,
  platformStateText,
} from "./platform-profile";
export { startScheduler, runSource } from "./scheduler";
