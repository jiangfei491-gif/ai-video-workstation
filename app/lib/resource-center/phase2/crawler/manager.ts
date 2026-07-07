import fs from "node:fs";

import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import type { ResourceCenterRepositoryBundle } from "@/database/repositories/resource-center";
import type { CrawlerTaskRow, ResourceSourceRow } from "@/database/repositories/resource-center/interfaces";
import { getResourceCenterRepos } from "@/database/repositories/resource-center";

import { requireCrawlerProvider } from "./registry";
import { getDownloaderManager } from "../downloader/manager";
import { resolveDownloadDir } from "../paths";
import type { CrawlStartOptions, ScanMode } from "../scheduler/types";
import { activityCrawlStart, activityCrawlDone } from "@/app/lib/workbench-activity/bridges/resource-center";
import { isJudged } from "../../phase3/judged-ledger";

const activeWorkers = new Map<string, AbortController>();
const pausedTasks = new Set<string>();
const seenUrlsByTask = new Map<string, Set<string>>();

/** 按资源类型的默认扩展名（拿不到文件名时用，避免存成 .bin） */
const EXT_BY_TYPE: Record<string, string> = {
  image: "jpg",
  video: "mp4",
  effect: "mp4",
  music: "mp3",
  sfx: "mp3",
  voice: "mp3",
  subtitle: "zip",
  lora: "safetensors",
  character: "safetensors",
  dataset: "bin",
  prompt: "txt",
  brand: "png",
};

/**
 * 推断带扩展名的文件名（优先 metadata.filename → title → URL basename → 按源类型兜底）
 */
function deriveFilename(
  item: { externalId?: string; title?: string; downloadUrl?: string; metadata?: Record<string, unknown> },
  source?: { resource_types?: string[] }
): string | undefined {
  const metaName = (item.metadata as { filename?: string } | undefined)?.filename;
  if (metaName) return metaName;
  const hasExt = (s: string) => /\.[a-z0-9]{2,5}$/i.test(s);
  if (item.title && hasExt(item.title)) return item.title;
  try {
    const base = new URL(item.downloadUrl!).pathname.split("/").filter(Boolean).pop();
    if (base && hasExt(base)) return decodeURIComponent(base);
  } catch {
    /* ignore */
  }
  // 兜底：按源的资源类型给合适扩展名（不再统一 .bin）
  const type = source?.resource_types?.[0];
  const ext = (type && EXT_BY_TYPE[type]) || "bin";
  return item.externalId ? `${item.externalId}.${ext}` : undefined;
}

export class CrawlerManager {
  constructor(private readonly repos: ResourceCenterRepositoryBundle = getResourceCenterRepos()) {}

  async start(
    sourceId: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    options?: CrawlStartOptions & { failureRetries?: number }
  ): Promise<CrawlerTaskRow> {
    const source = await this.repos.source.findById(sourceId);
    if (!source) throw new Error("资源站不存在");
    if (!source.enabled) throw new Error("资源站已禁用");
    if (!source.supports_crawler) throw new Error("该资源站不支持 Crawler");

    const task = await this.repos.crawlerTask.create(workspaceId, sourceId);
    await this.repos.crawlerTask.updateStatus(task.id, "pending", {
      progress: { options: options ?? {} },
    });
    await this.repos.crawlerTask.appendLog(task.id, "info", "任务已入队", { options });
    seenUrlsByTask.set(task.id, new Set());
    void this.runTask(task.id, source, options);
    return task;
  }

  async stop(taskId: string): Promise<CrawlerTaskRow | null> {
    activeWorkers.get(taskId)?.abort();
    activeWorkers.delete(taskId);
    pausedTasks.delete(taskId);
    return this.repos.crawlerTask.updateStatus(taskId, "cancelled");
  }

  async pause(taskId: string): Promise<CrawlerTaskRow | null> {
    pausedTasks.add(taskId);
    return this.repos.crawlerTask.updateStatus(taskId, "paused");
  }

  async resume(taskId: string): Promise<CrawlerTaskRow | null> {
    const task = await this.repos.crawlerTask.findById(taskId);
    if (!task) return null;
    const source = await this.repos.source.findById(task.source_id);
    if (!source) return null;
    pausedTasks.delete(taskId);
    const updated = await this.repos.crawlerTask.updateStatus(taskId, "running");
    void this.runTask(taskId, source);
    return updated;
  }

  async retry(taskId: string): Promise<CrawlerTaskRow | null> {
    const task = await this.repos.crawlerTask.findById(taskId);
    if (!task) return null;
    const source = await this.repos.source.findById(task.source_id);
    if (!source) return null;
    pausedTasks.delete(taskId);
    await this.repos.crawlerTask.updateStatus(taskId, "pending", {
      error_message: null,
      pages_done: 0,
      items_found: 0,
    });
    const running = await this.repos.crawlerTask.updateStatus(taskId, "running");
    void this.runTask(taskId, source);
    return running;
  }

  async getProgress(taskId: string) {
    const task = await this.repos.crawlerTask.findById(taskId);
    if (!task) return null;
    const logs = await this.repos.crawlerTask.listLogs(taskId, 50);
    return { task, logs };
  }

  private async runTask(
    taskId: string,
    source: ResourceSourceRow,
    options?: CrawlStartOptions & { failureRetries?: number }
  ): Promise<void> {
    if (activeWorkers.has(taskId)) return;
    const ac = new AbortController();
    activeWorkers.set(taskId, ac);
    const timeoutSec = options?.timeoutSec ?? 300;
    const maxItems = options?.maxItems;
    const scanMode: ScanMode = options?.scanMode ?? "new_only";
    const seen = seenUrlsByTask.get(taskId) ?? new Set<string>();
    const deadline = Date.now() + timeoutSec * 1000;
    let activityId = "";

    try {
      await this.repos.crawlerTask.updateStatus(taskId, "running");
      await this.repos.crawlerTask.appendLog(taskId, "info", `开始抓取: ${source.name}`, {
        provider: source.provider_slug,
      });
      activityId = activityCrawlStart(taskId, source.name); // 写入全站实时日志

      const provider = requireCrawlerProvider(source.provider_slug);
      const pageSize = 20;
      let page = 1;
      let itemsFound = 0;
      let hasMore = true;

      fs.mkdirSync(resolveDownloadDir(source.id, taskId), { recursive: true });

      while (hasMore && !ac.signal.aborted && !pausedTasks.has(taskId)) {
        if (Date.now() > deadline) {
          throw new Error(`抓取超时（${timeoutSec}s）`);
        }
        if (maxItems != null && itemsFound >= maxItems) {
          await this.repos.crawlerTask.appendLog(taskId, "info", `已达最大抓取数量 ${maxItems}`);
          break;
        }

        const list = await provider.listResources(source, { page, pageSize });
        await this.repos.crawlerTask.updateStatus(taskId, "running", {
          pages_total: list.totalPages,
          pages_done: page,
          items_found: itemsFound,
          progress: { page, pageSize, hasMore: list.hasMore },
        });
        await this.repos.crawlerTask.appendLog(taskId, "info", `第 ${page} 页: ${list.items.length} 条`);

        const downloader = getDownloaderManager(this.repos);
        for (const item of list.items) {
          if (ac.signal.aborted || pausedTasks.has(taskId)) break;
          if (maxItems != null && itemsFound >= maxItems) break;
          if (!source.supports_downloader || !item.externalId) continue;
          try {
            // 列表项已带下载链时直接用，省掉每条一次详情请求（大幅提速、能抓满上限）
            const dl = item.downloadUrl
              ? { downloadUrl: item.downloadUrl, filename: deriveFilename(item, source), sha256: undefined, bytesTotal: undefined }
              : await provider.getDownloadUrl(source, item.externalId);
            if (!dl.downloadUrl) continue;

            // 判定台账：已入库/已拒绝的直接跳过，不重复下载不重复分析
            if (isJudged(source.id, dl.downloadUrl)) continue;

            if (scanMode === "new_only" || scanMode === "incremental") {
              if (seen.has(dl.downloadUrl)) continue;
              seen.add(dl.downloadUrl);
            }

            await downloader.enqueue({
              workspaceId: source.workspace_id,
              sourceId: source.id,
              crawlerTaskId: taskId,
              remoteUrl: dl.downloadUrl,
              filename: dl.filename ?? `${item.externalId}.bin`,
              sha256Expected: dl.sha256 ?? null,
              bytesTotal: dl.bytesTotal ?? null,
            });
            itemsFound += 1;
          } catch (e) {
            await this.repos.crawlerTask.appendLog(taskId, "warn", `跳过条目 ${item.externalId}`, {
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        hasMore = list.hasMore;
        page += 1;
        if (page > 50) break;
      }

      if (pausedTasks.has(taskId)) {
        await this.repos.crawlerTask.appendLog(taskId, "info", "任务已暂停");
        return;
      }

      await this.repos.source.update(source.id, { last_crawled_at: new Date().toISOString() });
      await this.repos.crawlerTask.updateStatus(taskId, "completed", {
        items_found: itemsFound,
        pages_done: page - 1,
      });
      await this.repos.crawlerTask.appendLog(taskId, "info", `抓取完成，发现 ${itemsFound} 个可下载项`);
      if (activityId) activityCrawlDone(activityId, source.name, itemsFound, false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.repos.crawlerTask.updateStatus(taskId, "failed", { error_message: msg });
      await this.repos.crawlerTask.appendLog(taskId, "error", msg);
      if (activityId) activityCrawlDone(activityId, source.name, 0, true, msg.slice(0, 100));
    } finally {
      activeWorkers.delete(taskId);
      seenUrlsByTask.delete(taskId);
    }
  }
}

let singleton: CrawlerManager | null = null;

export function getCrawlerManager(repos?: ResourceCenterRepositoryBundle): CrawlerManager {
  if (repos) return new CrawlerManager(repos);
  if (!singleton) singleton = new CrawlerManager();
  return singleton;
}
