import fs from "node:fs";
import path from "node:path";

import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import {
  getResourceCenterPhase3Repos,
  getResourceCenterRepos,
} from "@/database/repositories/resource-center";
import type { ResourceCenterPhase3RepositoryBundle } from "@/database/repositories/resource-center/phase3-interfaces";
import type { ResourceCenterRepositoryBundle } from "@/database/repositories/resource-center/interfaces";

import { getLibraryDbMapping } from "../../db-mapping";
import { LIBRARY_BY_ID } from "../../libraries/definitions";
import { resolveLibraryStoragePath } from "../../paths";
import type { LibraryId } from "../../types";
import { recordVerdict } from "../judged-ledger";

const activeImport = new Set<string>();

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

export class LibraryIngestManager {
  constructor(
    private readonly p3: ResourceCenterPhase3RepositoryBundle = getResourceCenterPhase3Repos(),
    private readonly p2: ResourceCenterRepositoryBundle = getResourceCenterRepos()
  ) {}

  async enqueueFromAnalysis(analysisTaskId: string) {
    const analysis = await this.p3.analysisTask.findById(analysisTaskId);
    if (!analysis || analysis.status !== "analysis_complete") return null;

    const libraryId = (analysis.library_id ?? analysis.analysis_result.libraryId) as LibraryId;
    if (!libraryId || !LIBRARY_BY_ID[libraryId]) {
      throw new Error(`无效 libraryId: ${libraryId}`);
    }

    const importTask = await this.p3.importTask.create({
      workspace_id: analysis.workspace_id,
      analysis_task_id: analysis.id,
      library_id: libraryId,
    });
    await this.p3.importTask.appendLog(importTask.id, "info", "等待入库");
    void this.runImport(importTask.id);
    return importTask;
  }

  async runImport(importTaskId: string) {
    if (activeImport.has(importTaskId)) return;
    activeImport.add(importTaskId);

    try {
      const importTask = await this.p3.importTask.findById(importTaskId);
      if (!importTask) return;

      const analysis = await this.p3.analysisTask.findById(importTask.analysis_task_id);
      if (!analysis) throw new Error("分析任务不存在");

      await this.p3.importTask.update(importTaskId, {
        status: "importing",
        started_at: new Date().toISOString(),
      });
      await this.p3.importTask.appendLog(importTaskId, "info", "开始入库");

      const libraryId = importTask.library_id as LibraryId;
      const result = analysis.analysis_result;
      const srcPath = analysis.local_path;
      if (!fs.existsSync(srcPath)) throw new Error(`源文件不存在: ${srcPath}`);

      const storageRoot = resolveLibraryStoragePath(libraryId);
      fs.mkdirSync(storageRoot, { recursive: true });

      const safeName = analysis.filename.replace(/[^\w.\-()+[\]@]+/g, "_");
      const destName = `${Date.now()}_${safeName}`;
      const destPath = path.join(storageRoot, destName);
      fs.copyFileSync(srcPath, destPath);

      let thumbnailPath = "";
      let previewPath = "";
      if (isImageMime(analysis.mime_type)) {
        thumbnailPath = destPath;
        previewPath = destPath;
      }

      const mapping = getLibraryDbMapping(libraryId);
      const item = await this.p3.libraryItem.create({
        workspace_id: analysis.workspace_id,
        library_id: libraryId,
        download_task_id: analysis.download_task_id,
        analysis_task_id: analysis.id,
        import_task_id: importTaskId,
        source_id: analysis.source_id,
        title: result.title ?? analysis.filename,
        description: result.description ?? "",
        category: result.recommendedCategory ?? result.category ?? "",
        language: result.language ?? "zh",
        style: result.style ?? "",
        mood: result.mood ?? "",
        purpose: result.purpose ?? "",
        platform: result.platform ?? "",
        status: "imported",
        rating: result.rating ?? null,
        quality_score: result.qualityScore ?? null,
        enabled: true,
        favorite: false,
        local_path: destPath,
        thumbnail_path: thumbnailPath,
        preview_path: previewPath,
        tags: result.tags ?? [],
        keywords: result.keywords ?? [],
        sha256: analysis.sha256,
        file_size: analysis.file_size,
        mime_type: analysis.mime_type,
        metadata: {
          analysis: result,
          originalDownloadPath: srcPath,
        },
        db_primary_table: mapping.primaryTable,
        db_record_id: null,
      });

      if (result.isDuplicate && result.duplicateOfItemId) {
        await this.p3.libraryItem.addRelation(
          analysis.workspace_id,
          result.duplicateOfItemId,
          item.id,
          "duplicate",
          1
        );
      }

      await this.p3.importTask.update(importTaskId, {
        status: "imported",
        library_item_id: item.id,
        completed_at: new Date().toISOString(),
      });
      await this.p3.importTask.appendLog(importTaskId, "info", "入库完成", {
        libraryItemId: item.id,
        destPath,
      });

      // 入库成功：删掉下载暂存原件（library 已有独立副本），根治 downloads 膨胀
      try {
        if (srcPath && srcPath !== destPath && fs.existsSync(srcPath)) fs.unlinkSync(srcPath);
      } catch {
        /* 删暂存失败忽略 */
      }
      // 记判定台账：已入库，下次抓取到同一条直接跳过
      try {
        if (analysis.source_id && analysis.download_task_id) {
          const dt = await this.p2.downloadTask.findById(analysis.download_task_id);
          if (dt?.remote_url) recordVerdict(analysis.source_id, dt.remote_url, "ingested");
        }
      } catch {
        /* 台账失败忽略 */
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.p3.importTask.update(importTaskId, {
        status: "import_failed",
        error_message: msg,
        completed_at: new Date().toISOString(),
      });
      await this.p3.importTask.appendLog(importTaskId, "error", msg);
    } finally {
      activeImport.delete(importTaskId);
    }
  }

  async listImportTasks(status?: string) {
    return this.p3.importTask.list(
      DEFAULT_WORKSPACE_ID,
      status ? { status: status as "pending_import" } : undefined
    );
  }
}

let singleton: LibraryIngestManager | null = null;

export function getLibraryIngestManager(): LibraryIngestManager {
  if (!singleton) singleton = new LibraryIngestManager();
  return singleton;
}

/** Phase 3 Library Manager — 对外别名 */
export function getPhase3LibraryManager(): LibraryIngestManager {
  return getLibraryIngestManager();
}
