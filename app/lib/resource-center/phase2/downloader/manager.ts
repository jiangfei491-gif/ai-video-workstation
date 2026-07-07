import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { ResourceCenterRepositoryBundle } from "@/database/repositories/resource-center";
import type { DownloadTaskRow } from "@/database/repositories/resource-center/interfaces";
import { getResourceCenterRepos } from "@/database/repositories/resource-center";

import { resolveDownloadDir, resolveDownloadFilePath, resolveDownloadPartPath } from "../paths";

const activeDownloads = new Map<string, AbortController>();
const pausedDownloads = new Set<string>();

export interface EnqueueDownloadInput {
  workspaceId: string;
  sourceId: string;
  crawlerTaskId?: string | null;
  remoteUrl: string;
  filename: string;
  sha256Expected?: string | null;
  bytesTotal?: number | null;
}

export class DownloaderManager {
  constructor(private readonly repos: ResourceCenterRepositoryBundle = getResourceCenterRepos()) {}

  async enqueue(input: EnqueueDownloadInput): Promise<DownloadTaskRow> {
    const sourceId = input.sourceId || "manual";
    const task = await this.repos.downloadTask.create({
      workspace_id: input.workspaceId,
      source_id: input.sourceId,
      crawler_task_id: input.crawlerTaskId ?? null,
      remote_url: input.remoteUrl,
      local_path: "",
      filename: input.filename,
      bytes_total: input.bytesTotal ?? null,
      sha256_expected: input.sha256Expected ?? null,
      max_retries: 3,
    });
    const dir = resolveDownloadDir(sourceId, task.id);
    fs.mkdirSync(dir, { recursive: true });
    const localPath = resolveDownloadFilePath(sourceId, task.id, input.filename);
    await this.repos.downloadTask.update(task.id, { local_path: localPath });
    await this.repos.downloadTask.appendLog(task.id, "info", "下载任务已入队", { url: input.remoteUrl });
    void this.runDownload(task.id);
    return (await this.repos.downloadTask.findById(task.id))!;
  }

  async pause(taskId: string): Promise<DownloadTaskRow | null> {
    pausedDownloads.add(taskId);
    activeDownloads.get(taskId)?.abort();
    return this.repos.downloadTask.update(taskId, {
      status: "paused",
      paused_at: new Date().toISOString(),
    });
  }

  async resume(taskId: string): Promise<DownloadTaskRow | null> {
    pausedDownloads.delete(taskId);
    const task = await this.repos.downloadTask.findById(taskId);
    if (!task) return null;
    await this.repos.downloadTask.update(taskId, { status: "pending", paused_at: null });
    void this.runDownload(taskId);
    return this.repos.downloadTask.findById(taskId);
  }

  async cancel(taskId: string): Promise<DownloadTaskRow | null> {
    activeDownloads.get(taskId)?.abort();
    activeDownloads.delete(taskId);
    pausedDownloads.delete(taskId);
    return this.repos.downloadTask.update(taskId, { status: "cancelled" });
  }

  async retry(taskId: string): Promise<DownloadTaskRow | null> {
    const task = await this.repos.downloadTask.findById(taskId);
    if (!task) return null;
    if (task.retry_count >= task.max_retries) {
      throw new Error("已达最大重试次数");
    }
    await this.repos.downloadTask.update(taskId, {
      status: "pending",
      retry_count: task.retry_count + 1,
      error_message: null,
    });
    void this.runDownload(taskId);
    return this.repos.downloadTask.findById(taskId);
  }

  async getProgress(taskId: string) {
    const task = await this.repos.downloadTask.findById(taskId);
    if (!task) return null;
    const logs = await this.repos.downloadTask.listLogs(taskId, 50);
    return { task, logs };
  }

  private async runDownload(taskId: string): Promise<void> {
    if (activeDownloads.has(taskId)) return;
    const release = await import("../scheduler/concurrency").then((m) => m.acquireDownloadSlot());
    const task = await this.repos.downloadTask.findById(taskId);
    if (!task) {
      release();
      return;
    }

    const limits = await import("../scheduler/concurrency").then((m) => m.getSchedulerLimits());
    if (task.retry_count === 0 && task.max_retries !== limits.failureRetries && limits.failureRetries >= 0) {
      await this.repos.downloadTask.update(taskId, { max_retries: limits.failureRetries });
    }

    const ac = new AbortController();
    activeDownloads.set(taskId, ac);

    try {
      await this.repos.downloadTask.update(taskId, {
        status: "running",
        started_at: task.started_at ?? new Date().toISOString(),
      });
      await this.repos.downloadTask.appendLog(taskId, "info", "开始下载");

      const localPath = task.local_path;
      const partPath = resolveDownloadPartPath(localPath);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });

      let startByte = 0;
      if (fs.existsSync(partPath)) {
        startByte = fs.statSync(partPath).size;
      }

      const headers: Record<string, string> = {};
      if (startByte > 0) headers.Range = `bytes=${startByte}-`;

      const t0 = Date.now();
      const res = await fetch(task.remote_url, { signal: ac.signal, headers });
      if (!res.ok && res.status !== 206) {
        throw new Error(`HTTP ${res.status}`);
      }

      const contentLength = Number(res.headers.get("content-length") ?? 0);
      const total = startByte + contentLength;
      await this.repos.downloadTask.update(taskId, { bytes_total: total || task.bytes_total });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("无响应体");

      const fd = fs.openSync(partPath, startByte > 0 ? "a" : "w");
      let downloaded = startByte;

      while (!ac.signal.aborted && !pausedDownloads.has(taskId)) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          fs.writeSync(fd, Buffer.from(value));
          downloaded += value.length;
          const elapsed = Math.max(1, Date.now() - t0);
          const speedBps = Math.round(((downloaded - startByte) * 1000) / elapsed);
          if (downloaded % 65536 < value.length) {
            await this.repos.downloadTask.update(taskId, {
              bytes_downloaded: downloaded,
              speed_bps: speedBps,
            });
          }
        }
      }
      fs.closeSync(fd);

      if (pausedDownloads.has(taskId)) {
        await this.repos.downloadTask.appendLog(taskId, "info", "下载已暂停（支持断点续传）");
        return;
      }

      fs.renameSync(partPath, localPath);
      const sha256 = await hashFile(localPath);
      if (task.sha256_expected && task.sha256_expected !== sha256) {
        throw new Error(`Hash 校验失败: expected ${task.sha256_expected}, got ${sha256}`);
      }

      await this.repos.downloadTask.update(taskId, {
        status: "completed",
        bytes_downloaded: downloaded,
        sha256_actual: sha256,
        completed_at: new Date().toISOString(),
      });
      await this.repos.downloadTask.appendLog(taskId, "info", "下载完成", { sha256, path: localPath });

      try {
        const { getAnalyzerManager } = await import("../../phase3/ai-analyzer/manager");
        void getAnalyzerManager().enqueueFromDownload(taskId);
      } catch {
        /* Phase 3 optional at build time */
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.repos.downloadTask.update(taskId, { status: "failed", error_message: msg });
      await this.repos.downloadTask.appendLog(taskId, "error", msg);
    } finally {
      activeDownloads.delete(taskId);
      release();
    }
  }
}

async function hashFile(fp: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(fp);
    stream.on("data", (c) => hash.update(c));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

let singleton: DownloaderManager | null = null;

export function getDownloaderManager(repos?: ResourceCenterRepositoryBundle): DownloaderManager {
  if (!singleton) singleton = new DownloaderManager(repos);
  return singleton;
}
