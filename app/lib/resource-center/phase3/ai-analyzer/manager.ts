import fs from "node:fs";

import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import {
  getResourceCenterPhase3Repos,
  getResourceCenterRepos,
} from "@/database/repositories/resource-center";
import type {
  AnalysisTaskRow,
  ResourceCenterPhase3RepositoryBundle,
} from "@/database/repositories/resource-center/phase3-interfaces";
import type { ResourceCenterRepositoryBundle } from "@/database/repositories/resource-center/interfaces";

import { getLibraryIngestManager } from "../library-manager/manager";
import type { AnalyzerInput } from "../types";
import { guessMimeType } from "../types";
import { isDeepSeekAvailable, runDeepSeekResourceAnalysis } from "./deepseek-agent";
import { isVisionAvailable, isVisionCandidate, runVisionResourceAnalysis } from "./vision-agent";
import { activityAnalysisDone } from "@/app/lib/workbench-activity/bridges/resource-center";
import { recordVerdict } from "../judged-ledger";
import { recordCost } from "@/app/lib/cost-ledger/unified";

/** 入库质量分门槛（0-1）：低于此分直接拒绝、删文件、记台账。可调。 */
const MIN_QUALITY_SCORE = 0.5;

const activeAnalysis = new Set<string>();

export class AnalyzerManager {
  constructor(
    private readonly p3: ResourceCenterPhase3RepositoryBundle = getResourceCenterPhase3Repos(),
    private readonly p2: ResourceCenterRepositoryBundle = getResourceCenterRepos()
  ) {}

  async enqueueFromDownload(downloadTaskId: string): Promise<AnalysisTaskRow | null> {
    const existing = await this.p3.analysisTask.findByDownloadTask(downloadTaskId);
    if (existing) return existing;

    const download = await this.p2.downloadTask.findById(downloadTaskId);
    if (!download || download.status !== "completed") return null;
    if (!download.local_path || !fs.existsSync(download.local_path)) return null;

    const st = fs.statSync(download.local_path);
    const task = await this.p3.analysisTask.create({
      workspace_id: download.workspace_id,
      download_task_id: download.id,
      source_id: download.source_id,
      local_path: download.local_path,
      filename: download.filename,
      mime_type: guessMimeType(download.filename),
      file_size: st.size,
      sha256: download.sha256_actual,
    });
    await this.p3.analysisTask.appendLog(task.id, "info", "等待 AI 分析", {
      downloadTaskId,
    });
    void this.runAnalysis(task.id);
    return task;
  }

  async runAnalysis(taskId: string): Promise<AnalysisTaskRow | null> {
    if (activeAnalysis.has(taskId)) return this.p3.analysisTask.findById(taskId);

    const release = await import("../../phase2/scheduler/concurrency").then((m) =>
      m.acquireAnalysisSlot()
    );
    activeAnalysis.add(taskId);

    try {
      const task = await this.p3.analysisTask.findById(taskId);
      if (!task) return null;

      await this.p3.analysisTask.update(taskId, {
        status: "analyzing",
        started_at: new Date().toISOString(),
      });
      await this.p3.analysisTask.appendLog(taskId, "info", "开始 AI 分析", {
        deepseek: isDeepSeekAvailable(),
      });

      let sourceTypes: string[] = [];
      let sourceCategory = "";
      let sourceLanguage = "zh";
      if (task.source_id) {
        const source = await this.p2.source.findById(task.source_id);
        if (source) {
          sourceTypes = source.resource_types;
          sourceCategory = source.site_category;
          sourceLanguage = source.language;
        }
      }

      const input: AnalyzerInput = {
        filename: task.filename,
        localPath: task.local_path,
        mimeType: task.mime_type,
        fileSize: task.file_size,
        sha256: task.sha256,
        sourceResourceTypes: sourceTypes,
        sourceCategory,
        sourceLanguage,
      };

      const duplicate =
        task.sha256 &&
        (await this.p3.libraryItem.findBySha256(DEFAULT_WORKSPACE_ID, task.sha256));

      // 图片/视频用 Gemini 视觉分析（看图/抽帧）；其余（音频/数据集等）用 DeepSeek 文字分析。视觉失败自动回退。
      let result: Awaited<ReturnType<typeof runDeepSeekResourceAnalysis>>["result"];
      let cost: number;
      if (isVisionCandidate(input) && isVisionAvailable()) {
        try {
          ({ result, cost } = await runVisionResourceAnalysis(input));
          await this.p3.analysisTask.appendLog(taskId, "info", "视觉分析（Gemini）", { model: result.model });
        } catch (e) {
          await this.p3.analysisTask.appendLog(taskId, "warn", "视觉分析失败，回退 DeepSeek", {
            error: e instanceof Error ? e.message : String(e),
          });
          ({ result, cost } = await runDeepSeekResourceAnalysis(input));
        }
      } else {
        ({ result, cost } = await runDeepSeekResourceAnalysis(input));
      }

      if (duplicate) {
        result.isDuplicate = true;
        result.duplicateOfItemId = duplicate.id;
        result.canImport = false;
        result.rejectReason = "SHA256 重复";
      }

      // 质量分门槛：低于阈值直接拒
      if (
        result.canImport !== false &&
        typeof result.qualityScore === "number" &&
        result.qualityScore < MIN_QUALITY_SCORE
      ) {
        result.canImport = false;
        result.rejectReason = `评分不足（${result.qualityScore.toFixed(2)} < ${MIN_QUALITY_SCORE}）`;
      }

      const updated = await this.p3.analysisTask.update(taskId, {
        status: "analysis_complete",
        library_id: result.libraryId ?? null,
        analysis_result: result,
        completed_at: new Date().toISOString(),
      });

      await this.p3.analysisTask.appendLog(taskId, "info", "AI 分析完成", {
        libraryId: result.libraryId,
        canImport: result.canImport,
        cost,
        model: result.model,
      });
      // 记入全平台成本总账
      {
        const isVision = Boolean(result.model?.includes("vision") || result.model?.includes("gemini"));
        recordCost({
          module: "资源中心",
          operation: isVision ? "视觉分析" : "素材分析",
          provider: isVision ? "gemini" : "deepseek",
          model: result.model ?? "unknown",
          costUsd: cost,
          estimated: false,
          taskId,
        });
      }
      // 写入全站实时日志
      if (result.canImport !== false) {
        activityAnalysisDone(
          result.category || result.libraryId || "素材",
          result.title || input.filename,
          result.tags ?? [],
          Boolean(result.model?.includes("vision"))
        );
      }

      if (result.canImport !== false && result.libraryId) {
        void getLibraryIngestManager().enqueueFromAnalysis(taskId);
      } else {
        await this.p3.analysisTask.appendLog(taskId, "warn", "跳过入库", {
          reason: result.rejectReason ?? "canImport=false",
        });
        // 不达标：删掉下载的暂存文件（不占盘）+ 记判定台账（下次不重复下载）
        try {
          if (task.local_path && fs.existsSync(task.local_path)) fs.unlinkSync(task.local_path);
        } catch {
          /* 删文件失败忽略 */
        }
        try {
          if (task.source_id && task.download_task_id) {
            const dt = await this.p2.downloadTask.findById(task.download_task_id);
            if (dt?.remote_url) recordVerdict(task.source_id, dt.remote_url, "rejected", result.rejectReason);
          }
        } catch {
          /* 台账失败忽略 */
        }
      }

      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.p3.analysisTask.update(taskId, {
        status: "analysis_failed",
        error_message: msg,
        completed_at: new Date().toISOString(),
      });
      await this.p3.analysisTask.appendLog(taskId, "error", msg);
      return this.p3.analysisTask.findById(taskId);
    } finally {
      activeAnalysis.delete(taskId);
      release();
    }
  }

  async listTasks(status?: AnalysisTaskRow["status"]) {
    return this.p3.analysisTask.list(DEFAULT_WORKSPACE_ID, status ? { status } : undefined);
  }

  async getTask(taskId: string) {
    const task = await this.p3.analysisTask.findById(taskId);
    if (!task) return null;
    const logs = await this.p3.analysisTask.listLogs(taskId, 50);
    return { task, logs };
  }
}

let singleton: AnalyzerManager | null = null;

export function getAnalyzerManager(): AnalyzerManager {
  if (!singleton) singleton = new AnalyzerManager();
  return singleton;
}
