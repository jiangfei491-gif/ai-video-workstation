export { getSourceManager, SourceManager } from "./source-manager";

export type { CrawlerProvider, CrawlerResourceItem, CrawlerListResult } from "./crawler/provider";
export {
  getCrawlerProvider,
  listCrawlerProviders,
  requireCrawlerProvider,
  registerCrawlerProvider,
} from "./crawler/registry";
export { getCrawlerManager, CrawlerManager } from "./crawler/manager";

export { getDownloaderManager, DownloaderManager } from "./downloader/manager";
export type { EnqueueDownloadInput } from "./downloader/manager";

export {
  resolveDownloadsRoot,
  resolveDownloadDir,
  resolveDownloadFilePath,
} from "./paths";

export {
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_SOURCE_SCHEDULE,
  MAX_ITEMS_OPTIONS,
} from "./scheduler/types";
export type {
  CrawlMode,
  CrawlFrequency,
  ScanMode,
  SchedulePriority,
  SchedulerGlobalConfig,
  SourceScheduleConfig,
  SchedulerDashboard,
} from "./scheduler/types";

export { getCrawlerScheduler, startSchedulerTick, stopSchedulerTick } from "./scheduler/manager";
export { computeNextRunAt } from "./scheduler/cron-utils";
export { getSchedulerLimits } from "./scheduler/concurrency";
