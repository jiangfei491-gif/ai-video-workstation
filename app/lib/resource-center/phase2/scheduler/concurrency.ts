import { getResourceCenterSchedulerRepos } from "@/database/repositories/resource-center";
import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import { mergeGlobalConfig, speedLimitBytesPerSec } from "./cron-utils";
import { DEFAULT_SCHEDULER_CONFIG } from "./types";

export async function getSchedulerLimits() {
  try {
    const row = await getResourceCenterSchedulerRepos().scheduler.getConfig(DEFAULT_WORKSPACE_ID);
    const config = mergeGlobalConfig(row?.config ?? DEFAULT_SCHEDULER_CONFIG);
    return {
      downloadConcurrency: config.downloadConcurrency,
      analysisConcurrency: config.analysisConcurrency,
      failureRetries: config.failureRetries,
      downloadSpeedBps: speedLimitBytesPerSec(
        config.downloadSpeedLimit,
        config.downloadSpeedCustomMbps
      ),
    };
  } catch {
    return {
      downloadConcurrency: DEFAULT_SCHEDULER_CONFIG.downloadConcurrency,
      analysisConcurrency: DEFAULT_SCHEDULER_CONFIG.analysisConcurrency,
      failureRetries: DEFAULT_SCHEDULER_CONFIG.failureRetries,
      downloadSpeedBps: null as number | null,
    };
  }
}

let activeDownloads = 0;
let activeAnalysis = 0;

export function getActiveDownloadCount(): number {
  return activeDownloads;
}

export function getActiveAnalysisCount(): number {
  return activeAnalysis;
}

export async function acquireDownloadSlot(): Promise<() => void> {
  const limits = await getSchedulerLimits();
  while (activeDownloads >= limits.downloadConcurrency) {
    await new Promise((r) => setTimeout(r, 200));
  }
  activeDownloads += 1;
  return () => {
    activeDownloads = Math.max(0, activeDownloads - 1);
  };
}

export async function acquireAnalysisSlot(): Promise<() => void> {
  const limits = await getSchedulerLimits();
  while (activeAnalysis >= limits.analysisConcurrency) {
    await new Promise((r) => setTimeout(r, 300));
  }
  activeAnalysis += 1;
  return () => {
    activeAnalysis = Math.max(0, activeAnalysis - 1);
  };
}
