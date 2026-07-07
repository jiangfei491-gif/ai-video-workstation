import fs from "node:fs";
import path from "node:path";

import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import {
  getResourceCenterRepos,
  getResourceCenterSchedulerRepos,
} from "@/database/repositories/resource-center";
import type { ResourceCenterRepositoryBundle } from "@/database/repositories/resource-center/interfaces";
import type { ResourceCenterSchedulerRepositoryBundle } from "@/database/repositories/resource-center/scheduler-interfaces";

import { getCrawlerManager } from "../crawler/manager";
import { resolveDownloadsRoot } from "../paths";
import {
  computeNextRunAt,
  mergeGlobalConfig,
  sortSourcesByStrategy,
} from "./cron-utils";
import {
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_SOURCE_SCHEDULE,
  type CrawlStartOptions,
  type SchedulerDashboard,
  type SchedulerGlobalConfig,
  type SourceScheduleConfig,
} from "./types";

const TICK_MS = 60_000;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let tickStarted = false;

export class CrawlerScheduler {
  constructor(
    private readonly schedRepos: ResourceCenterSchedulerRepositoryBundle = getResourceCenterSchedulerRepos(),
    private readonly repos: ResourceCenterRepositoryBundle = getResourceCenterRepos()
  ) {}

  async getGlobalConfig(workspaceId = DEFAULT_WORKSPACE_ID): Promise<{
    config: SchedulerGlobalConfig;
    paused: boolean;
  }> {
    const row = await this.schedRepos.scheduler.getConfig(workspaceId);
    if (!row) {
      const created = await this.schedRepos.scheduler.upsertConfig(
        workspaceId,
        DEFAULT_SCHEDULER_CONFIG,
        false
      );
      return { config: created.config, paused: created.paused };
    }
    return { config: mergeGlobalConfig(row.config), paused: row.paused };
  }

  async updateGlobalConfig(
    patch: Partial<SchedulerGlobalConfig>,
    workspaceId = DEFAULT_WORKSPACE_ID
  ) {
    const current = await this.getGlobalConfig(workspaceId);
    const config = mergeGlobalConfig({ ...current.config, ...patch });
    return this.schedRepos.scheduler.upsertConfig(workspaceId, config, current.paused);
  }

  async setPaused(paused: boolean, workspaceId = DEFAULT_WORKSPACE_ID) {
    await this.schedRepos.scheduler.setPaused(workspaceId, paused);
    await this.schedRepos.scheduler.appendLog(workspaceId, "info", paused ? "调度器已暂停" : "调度器已恢复");
  }

  async getSourceSchedule(sourceId: string) {
    const row = await this.schedRepos.scheduler.getSourceSchedule(sourceId);
    if (row) return row;
    return this.schedRepos.scheduler.upsertSourceSchedule(DEFAULT_WORKSPACE_ID, sourceId, {
      ...DEFAULT_SOURCE_SCHEDULE,
      next_run_at: computeNextRunAt(DEFAULT_SOURCE_SCHEDULE)?.toISOString() ?? null,
    });
  }

  async listSchedules(workspaceId = DEFAULT_WORKSPACE_ID) {
    return this.schedRepos.scheduler.listAllSchedules(workspaceId);
  }

  async updateSourceSchedule(
    sourceId: string,
    patch: Partial<SourceScheduleConfig> & { metadata?: Record<string, unknown> },
    workspaceId = DEFAULT_WORKSPACE_ID
  ) {
    const merged = { ...DEFAULT_SOURCE_SCHEDULE, ...patch };
    const next = computeNextRunAt(merged);
    return this.schedRepos.scheduler.upsertSourceSchedule(workspaceId, sourceId, {
      ...patch,
      next_run_at: next?.toISOString() ?? null,
    });
  }

  async ensureAllSourceSchedules(workspaceId = DEFAULT_WORKSPACE_ID) {
    const sources = await this.repos.source.list(workspaceId, { enabled: true });
    const global = await this.getGlobalConfig(workspaceId);
    for (const s of sources.items) {
      const existing = await this.schedRepos.scheduler.getSourceSchedule(s.id);
      if (!existing) {
        const schedule: SourceScheduleConfig = {
          ...DEFAULT_SOURCE_SCHEDULE,
          crawlTimes: global.config.defaultCrawlTimes,
          maxItems: global.config.defaultMaxItemsPerSite,
          scanMode: global.config.defaultScanMode,
        };
        await this.schedRepos.scheduler.upsertSourceSchedule(workspaceId, s.id, {
          ...schedule,
          next_run_at: computeNextRunAt(schedule)?.toISOString() ?? null,
        });
      }
    }
  }

  /** 立即同步（手动触发） */
  async syncNow(sourceId: string, workspaceId = DEFAULT_WORKSPACE_ID) {
    return this.triggerCrawl(sourceId, workspaceId, { triggerType: "sync_now" });
  }

  async triggerCrawl(
    sourceId: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    opts?: CrawlStartOptions
  ) {
    const global = await this.getGlobalConfig(workspaceId);
    const schedule = await this.getSourceSchedule(sourceId);
    const maxItems =
      opts?.maxItems ??
      (schedule.max_items === 0 ? undefined : schedule.max_items) ??
      global.config.defaultMaxItemsPerSite;

    const run = await this.schedRepos.scheduler.createRun({
      workspace_id: workspaceId,
      source_id: sourceId,
      trigger_type: opts?.triggerType ?? "manual",
    });

    try {
      const task = await getCrawlerManager(this.repos).start(sourceId, workspaceId, {
        maxItems: maxItems === 0 ? undefined : maxItems,
        scanMode: (opts?.scanMode ?? schedule.scan_mode) as SourceScheduleConfig["scanMode"],
        timeoutSec: opts?.timeoutSec ?? global.config.crawlTimeoutSec,
        failureRetries: global.config.failureRetries,
      });

      await this.schedRepos.scheduler.updateRun(run.id, {
        crawler_task_id: task.id,
        status: "running",
      });

      const now = new Date().toISOString();
      const next = computeNextRunAt({
        frequency: schedule.frequency as SourceScheduleConfig["frequency"],
        customCron: schedule.custom_cron,
        crawlTimes: schedule.crawl_times,
      });

      await this.schedRepos.scheduler.upsertSourceSchedule(workspaceId, sourceId, {
        last_run_at: now,
        last_sync_at: opts?.triggerType === "sync_now" ? now : schedule.last_sync_at,
        next_run_at: next?.toISOString() ?? null,
      });

      await this.schedRepos.scheduler.appendLog(workspaceId, "info", `触发抓取: ${sourceId}`, {
        taskId: task.id,
        trigger: opts?.triggerType ?? "manual",
      });

      return { run, task };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.schedRepos.scheduler.updateRun(run.id, {
        status: "failed",
        error_message: msg,
        completed_at: new Date().toISOString(),
      });
      throw e;
    }
  }

  async tick(workspaceId = DEFAULT_WORKSPACE_ID) {
    const { config, paused } = await this.getGlobalConfig(workspaceId);
    if (paused || !config.autoCrawlEnabled) return;

    await this.ensureAllSourceSchedules(workspaceId);
    await this.runMaintenance(workspaceId, config);

    const due = await this.schedRepos.scheduler.listDueSchedules(workspaceId, new Date());
    const sorted = sortSourcesByStrategy(
      due.map((d) => ({ ...d, priority: d.priority as SourceScheduleConfig["priority"] })),
      config.pollingStrategy
    );

    for (const item of sorted) {
      const running = await this.repos.crawlerTask.list(workspaceId, { source_id: item.source_id, status: "running" });
      if (running.total > 0) continue;

      try {
        await this.triggerCrawl(item.source_id, workspaceId, { triggerType: "scheduled" });
      } catch (e) {
        await this.schedRepos.scheduler.appendLog(workspaceId, "warn", `调度跳过: ${item.source_id}`, {
          error: e instanceof Error ? e.message : String(e),
        });
        if (config.skipOnFailure) continue;
      }
    }
  }

  async runMaintenance(workspaceId: string, config: SchedulerGlobalConfig) {
    if (config.logRetentionDays > 0) {
      const before = new Date();
      before.setDate(before.getDate() - config.logRetentionDays);
      await this.schedRepos.scheduler.purgeLogs(workspaceId, before);
    }

    const root = resolveDownloadsRoot();
    if (!fs.existsSync(root)) return;

    const rules = config.autoCleanup;
    const now = Date.now();

    if (rules.downloads.enabled) {
      this.cleanupDir(root, rules.downloads.retentionDays, now);
    }
    if (rules.failedFiles.enabled) {
      this.cleanupFailedDownloads(root, rules.failedFiles.retentionDays, now);
    }
  }

  private cleanupDir(dir: string, retentionDays: number, now: number) {
    if (!fs.existsSync(dir)) return;
    const maxAge = retentionDays * 86400_000;
    for (const name of fs.readdirSync(dir)) {
      const fp = path.join(dir, name);
      try {
        const st = fs.statSync(fp);
        if (now - st.mtimeMs > maxAge) {
          fs.rmSync(fp, { recursive: true, force: true });
        }
      } catch {
        /* skip */
      }
    }
  }

  private cleanupFailedDownloads(root: string, retentionDays: number, now: number) {
    const maxAge = retentionDays * 86400_000;
    for (const src of fs.readdirSync(root)) {
      const srcDir = path.join(root, src);
      if (!fs.statSync(srcDir).isDirectory()) continue;
      for (const task of fs.readdirSync(srcDir)) {
        const part = path.join(srcDir, task);
        for (const f of fs.readdirSync(part)) {
          if (f.endsWith(".part") || f.endsWith(".failed")) {
            const fp = path.join(part, f);
            if (now - fs.statSync(fp).mtimeMs > maxAge) fs.unlinkSync(fp);
          }
        }
      }
    }
  }

  async getDashboard(workspaceId = DEFAULT_WORKSPACE_ID): Promise<SchedulerDashboard> {
    const { paused, config } = await this.getGlobalConfig(workspaceId);

    const [runningC, pendingC, runningD, pendingD] = await Promise.all([
      this.repos.crawlerTask.list(workspaceId, { status: "running" }),
      this.repos.crawlerTask.list(workspaceId, { status: "pending" }),
      this.repos.downloadTask.list(workspaceId, { status: "running" }),
      this.repos.downloadTask.list(workspaceId, { status: "pending" }),
    ]);

    let runningA = 0;
    let pendingA = 0;
    try {
      const { getResourceCenterPhase3Repos } = await import("@/database/repositories/resource-center");
      const p3 = getResourceCenterPhase3Repos();
      const [ra, pa] = await Promise.all([
        p3.analysisTask.list(workspaceId, { status: "analyzing" }),
        p3.analysisTask.list(workspaceId, { status: "pending_analysis" }),
      ]);
      runningA = ra.total;
      pendingA = pa.total;
    } catch {
      /* phase3 optional */
    }

    const runs = await this.schedRepos.scheduler.listRecentRuns(workspaceId, 200);
    const successTotal = runs.filter((r) => r.status === "completed").length;
    const failedTotal = runs.filter((r) => r.status === "failed").length;
    const crawledTotal = runs.reduce((s, r) => s + r.items_found, 0);

    const downloadSpeedBps =
      runningD.items.reduce((s, t) => s + (t.speed_bps ?? 0), 0) / Math.max(1, runningD.total);

    const hourAgo = Date.now() - 3600_000;
    const recentRuns = runs.filter((r) => Date.parse(r.created_at) > hourAgo);
    const crawlSpeedPerHour = recentRuns.length;
    const analysisSpeedPerHour = Math.round(runningA + pendingA * 0.5);

    const waiting = pendingC.total + pendingD.total + pendingA;
    const estimatedCompletionAt =
      waiting > 0
        ? new Date(Date.now() + waiting * 120_000).toISOString()
        : null;

    const activeTasks = [
      ...runningC.items.map((t) => ({
        id: t.id,
        type: "crawler" as const,
        sourceId: t.source_id,
        status: t.status,
        progress: `${t.pages_done}/${t.pages_total ?? "?"}`,
      })),
      ...runningD.items.slice(0, 10).map((t) => ({
        id: t.id,
        type: "download" as const,
        sourceId: t.source_id ?? undefined,
        status: t.status,
        progress: `${t.bytes_downloaded}/${t.bytes_total ?? "?"}`,
      })),
    ];

    return {
      paused,
      runningCrawlers: runningC.total,
      waitingCrawlers: pendingC.total,
      runningDownloads: Math.min(runningD.total, config.downloadConcurrency),
      waitingDownloads: pendingD.total,
      runningAnalysis: Math.min(runningA, config.analysisConcurrency),
      waitingAnalysis: pendingA,
      crawlSpeedPerHour,
      downloadSpeedBps,
      analysisSpeedPerHour,
      crawledTotal,
      failedTotal,
      successTotal,
      estimatedCompletionAt,
      activeTasks,
    };
  }
}

let singleton: CrawlerScheduler | null = null;

export function getCrawlerScheduler(): CrawlerScheduler {
  if (!singleton) singleton = new CrawlerScheduler();
  return singleton;
}

export function startSchedulerTick(): void {
  if (tickStarted || typeof window !== "undefined") return;
  tickStarted = true;
  const scheduler = getCrawlerScheduler();
  void scheduler.tick();
  tickTimer = setInterval(() => void scheduler.tick(), TICK_MS);
}

export function stopSchedulerTick(): void {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
  tickStarted = false;
}
