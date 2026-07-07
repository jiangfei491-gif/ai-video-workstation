/**
 * Crawler Scheduler — 类型与默认配置
 */

export type CrawlMode = "auto" | "manual";
export type CrawlFrequency = "hourly" | "daily" | "weekly" | "monthly" | "custom";
export type ScanMode = "new_only" | "full_rescan" | "incremental";
export type SchedulePriority = "high" | "medium" | "low";
export type PollingStrategy = "priority" | "sequential" | "random";
export type DownloadSpeedLimit = "unlimited" | "10mb" | "20mb" | "50mb" | "custom";
export type CpuLimit = "low" | "medium" | "high" | "custom";
export type NetworkRestriction = "any" | "wifi" | "wired";
export type LogRetention = 7 | 30 | 90 | 180 | -1;

export type AutoCleanupRule = {
  enabled: boolean;
  retentionDays: number;
};

export type SchedulerGlobalConfig = {
  autoCrawlEnabled: boolean;
  defaultCrawlTimes: string[];
  defaultScanMode: ScanMode;
  defaultMaxItemsPerSite: number;
  downloadConcurrency: number;
  analysisConcurrency: number;
  failureRetries: number;
  crawlTimeoutSec: number;
  downloadSpeedLimit: DownloadSpeedLimit;
  downloadSpeedCustomMbps: number;
  cpuLimit: CpuLimit;
  cpuCustomThreads: number;
  networkRestriction: NetworkRestriction;
  pollingStrategy: PollingStrategy;
  skipOnFailure: boolean;
  logRetentionDays: LogRetention;
  autoCleanup: {
    downloads: AutoCleanupRule;
    cache: AutoCleanupRule;
    failedFiles: AutoCleanupRule;
    duplicates: AutoCleanupRule;
  };
  autoImport: boolean;
};

export type SourceScheduleConfig = {
  enabled: boolean;
  crawlMode: CrawlMode;
  frequency: CrawlFrequency;
  customCron: string;
  crawlTimes: string[];
  maxItems: number;
  scanMode: ScanMode;
  priority: SchedulePriority;
};

export const DEFAULT_SCHEDULER_CONFIG: SchedulerGlobalConfig = {
  autoCrawlEnabled: true,
  defaultCrawlTimes: ["02:00"],
  defaultScanMode: "new_only",
  defaultMaxItemsPerSite: 100,
  downloadConcurrency: 5,
  analysisConcurrency: 3,
  failureRetries: 3,
  crawlTimeoutSec: 300,
  downloadSpeedLimit: "unlimited",
  downloadSpeedCustomMbps: 10,
  cpuLimit: "medium",
  cpuCustomThreads: 2,
  networkRestriction: "any",
  pollingStrategy: "priority",
  skipOnFailure: true,
  logRetentionDays: 90,
  autoCleanup: {
    downloads: { enabled: true, retentionDays: 7 },
    cache: { enabled: true, retentionDays: 7 },
    failedFiles: { enabled: true, retentionDays: 7 },
    duplicates: { enabled: true, retentionDays: 30 },
  },
  autoImport: false,
};

export const DEFAULT_SOURCE_SCHEDULE: SourceScheduleConfig = {
  enabled: true,
  crawlMode: "manual",
  frequency: "daily",
  customCron: "",
  crawlTimes: ["02:00"],
  maxItems: 100,
  scanMode: "new_only",
  priority: "medium",
};

export const MAX_ITEMS_OPTIONS = [10, 50, 100, 500, 1000, 0] as const;

export type CrawlStartOptions = {
  maxItems?: number;
  scanMode?: ScanMode;
  timeoutSec?: number;
  triggerType?: "scheduled" | "manual" | "sync_now";
};

export type SchedulerDashboard = {
  paused: boolean;
  runningCrawlers: number;
  waitingCrawlers: number;
  runningDownloads: number;
  waitingDownloads: number;
  runningAnalysis: number;
  waitingAnalysis: number;
  crawlSpeedPerHour: number;
  downloadSpeedBps: number;
  analysisSpeedPerHour: number;
  crawledTotal: number;
  failedTotal: number;
  successTotal: number;
  estimatedCompletionAt: string | null;
  activeTasks: Array<{
    id: string;
    type: "crawler" | "download" | "analysis";
    sourceId?: string;
    status: string;
    progress?: string;
  }>;
};
