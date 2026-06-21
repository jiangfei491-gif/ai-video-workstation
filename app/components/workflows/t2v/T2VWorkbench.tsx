"use client";

import { useEffect, useState } from "react";
import ExportPanel from "@/app/components/workflows/shared/ExportPanel";
import GenerationModeToggle from "@/app/components/workflows/shared/GenerationModeToggle";
import LoadingButton from "@/app/components/workflows/shared/LoadingButton";
import ShotLockPanel from "@/app/components/workflows/shared/ShotLockPanel";
import TaskStatusBar from "@/app/components/workflows/shared/TaskStatusBar";
import VeoProgressPanel from "@/app/components/workflows/shared/VeoProgressPanel";
import VideoPreviewPanel from "@/app/components/workflows/shared/VideoPreviewPanel";
import WorkbenchSection from "@/app/components/workflows/shared/WorkbenchSection";
import BatchGeneratePanel from "@/app/components/workflows/t2v/BatchGeneratePanel";
import ProjectCharactersPanel from "@/app/components/workflows/t2v/ProjectCharactersPanel";
import StoryboardPanel from "@/app/components/workflows/t2v/StoryboardPanel";
import VideoSettingsPanel from "@/app/components/workflows/t2v/VideoSettingsPanel";
import { resolveRequestSeed } from "@/app/lib/generation-params";
import type { GenerationMode } from "@/app/lib/generation-mode";
import { exportT2VProject, exportT2VVideo } from "@/app/lib/export/executors";
import { runWorkbenchExport, resetExportMeta } from "@/app/lib/export/run-export";
import { isExportSuccess } from "@/app/lib/export/types";
import { patchVideoHistoryExport } from "@/app/lib/history/video-store";
import { syncVideoHistoryFromWorkbench } from "@/app/lib/history/sync-video";
import { normalizeVeoDurationSec } from "@/app/lib/shot-control/types";
import {
  getT2VState,
  runT2VBatchTask,
  runT2VVeoTask,
  setT2VState,
  useT2VWorkbenchStore,
} from "@/app/lib/workbench-persist/t2v-store";
import type {
  BatchShotState,
  DirectorShot,
  StoryboardShot,
  VeoTestResult,
} from "@/app/lib/workbench-persist/types";

/** 批量并行时的并发上限，避免一次性打满 API 触发限流 */
const BATCH_CONCURRENCY = 3;

const VEO_MODEL = "veo-3.1-generate-preview";

function batchShotToTestResult(shot: BatchShotState | undefined): VeoTestResult | null {
  if (!shot || shot.status !== "success" || !shot.videoUrl || !shot.taskId) {
    return null;
  }
  return {
    taskId: shot.taskId,
    videoUrl: shot.videoUrl,
    seed: shot.seed ?? 0,
    firstFrameAssetId: shot.firstFrameAssetId,
    firstFrameUrl: shot.firstFrameUrl,
  };
}

function reorderArray<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function T2VWorkbench() {
  const { state, patch } = useT2VWorkbenchStore();
  const [confirmDeleteExport, setConfirmDeleteExport] = useState(false);

  const {
    topic,
    workspaceMode,
    mode,
    director,
    activeShotIdx,
    testResult,
    shotLock,
    prodResult,
    batchRunning,
    batchResults,
    error,
    directorLoading,
    veoLoading,
    veoStatus,
    veoProgressStep,
    veoError,
    veoSuccessMessage,
    export: exportMeta,
    historyEntryId,
  } = state;

  const isPreview = workspaceMode === "preview";
  const activePrompt = director?.prompts[activeShotIdx];
  const activeBatchShot = batchResults[activeShotIdx];
  const restoredBatchResult = batchShotToTestResult(activeBatchShot);
  const effectiveTestResult = testResult ?? restoredBatchResult;
  const shotId = activePrompt ? `t2v-shot-${activeShotIdx + 1}` : "";
  const veoDurationSec = normalizeVeoDurationSec(state.shotDurationSec);
  const previewUrl =
    prodResult ??
    effectiveTestResult?.videoUrl ??
    null;

  useEffect(() => {
    if (director && (testResult || prodResult)) {
      syncVideoHistoryFromWorkbench(state).then((id) => {
        if (id && id !== state.historyEntryId) patch({ historyEntryId: id });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director, testResult, prodResult]);

  async function runDirector() {
    patch({ directorLoading: true, error: null });
    try {
      const consistencyNote = [
        state.characterConsistency ? "保持人物一致性" : "",
        state.sceneConsistency ? "保持场景一致性" : "",
      ]
        .filter(Boolean)
        .join("，");

      const res = await fetch("/api/director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: consistencyNote ? `${topic}（${consistencyNote}）` : topic,
          shotCount: state.shotCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "编导生成失败");

      const storyboard = (data.storyboard ?? []) as StoryboardShot[];
      const prompts: DirectorShot[] = (
        data.prompts as { sceneNumber: number; providerPrompt: string }[]
      ).map((p) => ({
        sceneNumber: p.sceneNumber,
        providerPrompt: p.providerPrompt,
        duration: state.shotDurationSec,
      }));

      patch({
        director: { title: data.title, script: data.script, storyboard, prompts },
        activeShotIdx: 0,
        testResult: null,
        shotLock: null,
        prodResult: null,
        batchRunning: false,
        batchResults: {},
        veoStatus: "idle",
        veoError: null,
        veoSuccessMessage: null,
        voiceoverText: state.voiceoverText || data.script.slice(0, 500),
        subtitleText: state.subtitleText || storyboard.map((s) => s.narration).filter(Boolean).join("\n"),
      });

      const historyId = await syncVideoHistoryFromWorkbench(
        { ...state, director: { title: data.title, script: data.script, storyboard, prompts } },
        { status: "running" }
      );
      patch({ historyEntryId: historyId });
    } catch (e) {
      patch({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      patch({ directorLoading: false });
    }
  }

  function runVeoTest() {
    if (!activePrompt || veoLoading) return;
    patch({
      veoLoading: true,
      veoStatus: "generating",
      veoProgressStep: 1,
      veoStartedAt: new Date().toISOString(),
      veoError: null,
      veoSuccessMessage: null,
      error: null,
    });

    runT2VVeoTask(async () => {
      const step2Timer = setTimeout(() => patch({ veoProgressStep: 2 }), 1200);
      try {
        const frameAsset = getT2VState().shotFrameAssets?.[activeShotIdx];
        const res = await fetch("/api/veo/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shotId,
            workspaceMode,
            mode: "test",
            // 有就地生成的首帧 → 图生视频，用首帧当参考保持一致
            type: frameAsset ? "i2v" : "t2v",
            imageAssetId: frameAsset,
            prompt: activePrompt.providerPrompt,
            model: VEO_MODEL,
            durationSec: veoDurationSec,
            aspectRatio: state.aspectRatio,
            seed: resolveRequestSeed(state.seedMode, state.seed),
          }),
        });
        patch({ veoProgressStep: 3 });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "视频预览失败");
        const nextTestResult: VeoTestResult = {
          taskId: data.taskId,
          videoUrl: data.videoUrl,
          seed: data.seed,
          firstFrameAssetId: data.firstFrameAssetId,
          firstFrameUrl: data.firstFrameUrl,
        };
        patch({
          testResult: nextTestResult,
          shotLock: null,
          veoStatus: "success",
          veoSuccessMessage: "视频生成完成",
          veoError: null,
        });
        patchBatchShot(activeShotIdx, {
          status: "success",
          videoUrl: data.videoUrl,
          taskId: data.taskId,
          seed: data.seed,
          firstFrameAssetId: data.firstFrameAssetId,
          firstFrameUrl: data.firstFrameUrl,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        patch({ veoStatus: "failed", veoError: msg, error: msg });
      } finally {
        clearTimeout(step2Timer);
        patch({ veoLoading: false });
      }
    });
  }

  async function lockShot() {
    if (!effectiveTestResult || !activePrompt) return;
    patch({ veoLoading: true, error: null });
    try {
      const imageAssetId = getT2VState().shotFrameAssets?.[activeShotIdx];
      const input = {
        shotId,
        prompt: activePrompt.providerPrompt,
        seed: effectiveTestResult.seed,
        firstFrameAssetId: effectiveTestResult.firstFrameAssetId ?? "preview",
        firstFrameUrl: effectiveTestResult.firstFrameUrl ?? effectiveTestResult.videoUrl ?? "",
        duration: veoDurationSec,
        aspectRatio: state.aspectRatio,
        model: VEO_MODEL,
        testTaskId: effectiveTestResult.taskId,
        testClipUrl: effectiveTestResult.videoUrl ?? "",
        imageAssetId,
      };
      if (isPreview) {
        patch({
          shotLock: {
            id: `preview-lock-${shotId}`,
            shotId,
            snapshot: { ...input, characterProfile: null, cameraProfile: null, lockedAt: new Date().toISOString() },
          },
          mode: "production",
        });
        return;
      }
      const res = await fetch("/api/director/shot-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "锁定失败");
      patch({ shotLock: data, mode: "production" });
    } catch (e) {
      patch({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      patch({ veoLoading: false });
    }
  }

  async function runVeoProduction() {
    if (!shotLock || !activePrompt || isPreview) return;
    patch({ veoLoading: true, veoStatus: "generating", veoProgressStep: 1, error: null });
    try {
      const res = await fetch("/api/veo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId,
          workspaceMode,
          mode: "production",
          type: shotLock.snapshot.imageAssetId ? "i2v" : "t2v",
          imageAssetId: shotLock.snapshot.imageAssetId,
          prompt: activePrompt.providerPrompt,
          seed: shotLock.snapshot.seed,
          model: shotLock.snapshot.model,
          durationSec: shotLock.snapshot.duration,
          aspectRatio: shotLock.snapshot.aspectRatio,
          shotLockId: shotLock.id,
        }),
      });
      patch({ veoProgressStep: 3 });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "视频正式生成失败");
      patch({
        prodResult: data.videoUrl,
        veoStatus: "success",
        veoSuccessMessage: "视频正式生成完成",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      patch({ veoStatus: "failed", veoError: msg, error: msg });
    } finally {
      patch({ veoLoading: false });
    }
  }

  async function unlockShot() {
    if (!activePrompt) return;
    if (!isPreview) {
      await fetch(`/api/director/shot-lock?shotId=${encodeURIComponent(shotId)}`, { method: "DELETE" });
    }
    patch({ shotLock: null, mode: "test", prodResult: null });
  }

  function selectShot(i: number) {
    const restoredTest = batchShotToTestResult(batchResults[i]);
    patch({
      activeShotIdx: i,
      testResult: restoredTest,
      shotLock: null,
      prodResult: null,
      mode: "test",
      veoStatus: restoredTest ? "success" : "idle",
      veoError: null,
      veoSuccessMessage: restoredTest ? "已切换到该镜头的预览结果" : null,
    });
  }

  function patchBatchShot(index: number, shot: BatchShotState) {
    setT2VState({
      batchResults: { ...getT2VState().batchResults, [index]: shot },
    });
  }

  /** 生成单个镜头（test 预览），更新 batchResults[index] */
  async function generateOneShot(index: number, prompt: string) {
    patchBatchShot(index, { status: "generating", videoUrl: null });
    try {
      const frameAsset = getT2VState().shotFrameAssets?.[index];
      const res = await fetch("/api/veo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId: `t2v-shot-${index + 1}`,
          workspaceMode,
          mode: "test",
          type: frameAsset ? "i2v" : "t2v",
          imageAssetId: frameAsset,
          prompt,
          model: VEO_MODEL,
          durationSec: veoDurationSec,
          aspectRatio: state.aspectRatio,
          seed: resolveRequestSeed(state.seedMode, state.seed),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失败");
      patchBatchShot(index, {
        status: "success",
        videoUrl: data.videoUrl,
        taskId: data.taskId,
        seed: data.seed,
        firstFrameAssetId: data.firstFrameAssetId,
        firstFrameUrl: data.firstFrameUrl,
      });
    } catch (e) {
      patchBatchShot(index, {
        status: "failed",
        videoUrl: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function runBatch() {
    if (!director || batchRunning) return;
    const prompts = director.prompts;
    const init: Record<number, BatchShotState> = {};
    prompts.forEach((_, i) => {
      init[i] = { status: "pending", videoUrl: null };
    });
    patch({ batchRunning: true, batchResults: init, error: null });

    runT2VBatchTask(async () => {
      let cursor = 0;
      const worker = async () => {
        while (cursor < prompts.length) {
          const i = cursor++;
          await generateOneShot(i, prompts[i].providerPrompt);
        }
      };
      const workers = Array.from(
        { length: Math.min(BATCH_CONCURRENCY, prompts.length) },
        worker
      );
      await Promise.all(workers);
      patch({ batchRunning: false });
    });
  }

  function retryShot(index: number) {
    if (!director || batchRunning) return;
    const prompt = director.prompts[index]?.providerPrompt;
    if (!prompt) return;
    runT2VBatchTask(async () => {
      patch({ batchRunning: true });
      await generateOneShot(index, prompt);
      patch({ batchRunning: false });
    });
  }

  function reorderShots(from: number, to: number) {
    if (!director) return;
    const prompts = reorderArray(director.prompts, from, to);
    const storyboard = reorderArray(director.storyboard, from, to);
    patch({ director: { ...director, prompts, storyboard }, activeShotIdx: to });
  }

  function updatePrompt(index: number, providerPrompt: string) {
    if (!director) return;
    patch({
      director: {
        ...director,
        prompts: director.prompts.map((p, i) => (i === index ? { ...p, providerPrompt } : p)),
      },
    });
  }

  async function syncExportHistory(meta: ReturnType<typeof getT2VState>["export"]) {
    if (historyEntryId) {
      patchVideoHistoryExport(historyEntryId, meta);
    } else if (director) {
      const id = await syncVideoHistoryFromWorkbench(getT2VState());
      patch({ historyEntryId: id });
    }
  }

  async function handleExportProject() {
    if (!director) {
      patch({
        export: {
          ...exportMeta,
          exportStatus: "failed",
          exportError: "请先完成编导生成",
          lastExportType: "project",
        },
      });
      return;
    }
    try {
      const meta = await runWorkbenchExport({
        exportType: "project",
        fileName: `project_${(topic || "video").replace(/\s+/g, "_")}.zip`,
        getExport: () => getT2VState().export,
        patchExport: (m) => patch({ export: m }),
        execute: async (onProgress) => {
          const name = await exportT2VProject(getT2VState(), onProgress);
          onProgress(100, "导出完成");
          void name;
        },
      });
      await syncExportHistory(meta);
    } catch {
      /* failed state patched */
    }
  }

  async function handleExportVideo() {
    if (!previewUrl) {
      patch({
        export: {
          ...exportMeta,
          exportStatus: "failed",
          exportError: "没有可导出的视频",
          lastExportType: "video",
        },
      });
      return;
    }
    try {
      const exportTopic = (director?.title ?? topic) || "video";
      const fileName = `${exportTopic.replace(/\s+/g, "_")}_video.mp4`;
      const meta = await runWorkbenchExport({
        exportType: "video",
        fileName,
        getExport: () => getT2VState().export,
        patchExport: (m) => patch({ export: m }),
        execute: async (onProgress) => {
          await exportT2VVideo(previewUrl, exportTopic, onProgress);
        },
      });
      await syncExportHistory(meta);
    } catch {
      /* failed state patched */
    }
  }

  function deleteExportRecord() {
    const cleared = resetExportMeta();
    patch({ export: cleared });
    if (historyEntryId) patchVideoHistoryExport(historyEntryId, cleared);
    setConfirmDeleteExport(false);
  }

  const pipelineSteps = [
    { id: "topic", label: "主题", status: topic.trim() ? ("done" as const) : ("pending" as const) },
    { id: "director", label: "编导", status: directorLoading ? ("active" as const) : director ? ("done" as const) : ("pending" as const) },
    { id: "veo", label: "视频生成", status: veoStatus === "generating" ? ("active" as const) : veoStatus === "success" ? ("done" as const) : veoStatus === "failed" ? ("failed" as const) : ("pending" as const) },
    {
      id: "export",
      label: "导出",
      status:
        exportMeta.exportStatus === "exporting"
          ? ("active" as const)
          : isExportSuccess(exportMeta)
            ? ("done" as const)
            : exportMeta.exportStatus === "failed"
              ? ("failed" as const)
              : ("pending" as const),
      },
  ];

  const activeStoryboard = director?.storyboard[activeShotIdx];
  const completedBatchCount = Object.values(batchResults).filter(
    (shot) => shot.status === "success"
  ).length;
  const failedBatchCount = Object.values(batchResults).filter(
    (shot) => shot.status === "failed"
  ).length;
  const activeShotLabel = director
    ? `镜头 ${activeShotIdx + 1} / ${director.prompts.length}`
    : "等待编导生成分镜";
  const hasActiveFrame = Boolean(state.shotFrames?.[activeShotIdx]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
        <h1 className="workbench-page-title">视频创作</h1>
        <p className="workbench-page-desc mt-1">
          文生视频 · 项目设定 → 编导分镜 → 单镜生成/锁定 → 导出
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <TaskStatusBar steps={pipelineSteps} />

        <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.92fr)_minmax(560px,1.45fr)]">
          <div className="min-w-0">
            <WorkbenchSection title="1. 项目起步">
              <label className="workbench-label mb-2 block">视频主题</label>
              <textarea
                className="input-field min-h-[96px] w-full rounded-lg px-3 py-2.5 text-sm leading-relaxed"
                value={topic}
                onChange={(e) => patch({ topic: e.target.value })}
                placeholder="写清楚题材、人物、情绪和目标受众；例如：一个创业者深夜用 AI 做完一支广告片"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <LoadingButton
                  loading={directorLoading}
                  loadingText="编导运行中…"
                  disabled={!topic.trim() || directorLoading}
                  onClick={runDirector}
                >
                  {director ? "重新运行编导" : "运行编导"}
                </LoadingButton>
                {director && (
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    已生成 {director.prompts.length} 个镜头
                  </span>
                )}
              </div>
            </WorkbenchSection>

            <WorkbenchSection title="2. 本项目角色">
              <ProjectCharactersPanel
                characterIds={state.characterIds}
                onChange={(ids) => patch({ characterIds: ids })}
              />
            </WorkbenchSection>

            <WorkbenchSection title="3. 项目设定">
              <VideoSettingsPanel state={state} patch={patch} disabled={directorLoading || veoLoading} />
            </WorkbenchSection>

            {director && (
              <WorkbenchSection title="剧本 / 声音">
                <h3 className="workbench-heading mb-2">{director.title}</h3>
                <p className="workbench-body max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3 leading-relaxed">
                  {director.script}
                </p>
                <div className="mt-4 grid gap-3">
                  <div>
                    <label className="workbench-label mb-1.5 block">配音文案</label>
                    <textarea
                      className="input-field min-h-[80px] w-full rounded-lg px-3 py-2.5 text-sm"
                      value={state.voiceoverText}
                      onChange={(e) => patch({ voiceoverText: e.target.value })}
                      placeholder="配音文案"
                    />
                  </div>
                  <div>
                    <label className="workbench-label mb-1.5 block">字幕内容</label>
                    <textarea
                      className="input-field min-h-[80px] w-full rounded-lg px-3 py-2.5 text-sm"
                      value={state.subtitleText}
                      onChange={(e) => patch({ subtitleText: e.target.value })}
                      placeholder="字幕内容"
                    />
                  </div>
                </div>
              </WorkbenchSection>
            )}

            <ExportPanel
              workbench="t2v"
              exportMeta={exportMeta}
              canExportProject={!!director}
              canExportMedia={!!previewUrl}
              onExportProject={handleExportProject}
              onExportMedia={handleExportVideo}
              onDeleteRecord={() => setConfirmDeleteExport(true)}
            />
          </div>

          <div className="min-w-0 xl:sticky xl:top-0 xl:self-start">
            {!director ? (
              <section className="glass-panel rounded-xl p-5">
                <h2 className="workbench-section-title mb-3">镜头生产台</h2>
                <div className="grid gap-3 text-sm text-[var(--text-secondary)]">
                  <p>先在左侧写主题、设定镜头数量和工作模式，然后运行编导。</p>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3">
                    <p className="font-semibold text-[var(--text-primary)]">推荐顺序</p>
                    <p className="mt-1 leading-relaxed">
                      主题 → 项目设定 → 导入角色 → 运行编导 → 改镜头 Prompt → 生成预览 → 锁定 → 正式生成
                    </p>
                  </div>
                </div>
              </section>
            ) : (
              <>
                <section className="glass-panel mb-4 rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="workbench-caption">当前处理</p>
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                        {activeShotLabel}
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-medium">
                      <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[var(--accent)]">
                        {veoDurationSec}s Veo
                      </span>
                      <span className="rounded-full bg-[var(--bg-inset)] px-2.5 py-1 text-[var(--text-secondary)]">
                        {hasActiveFrame ? "有首帧" : "无首帧"}
                      </span>
                      <span className="rounded-full bg-[var(--bg-inset)] px-2.5 py-1 text-[var(--text-secondary)]">
                        批量 {completedBatchCount}/{director.prompts.length}
                        {failedBatchCount ? ` · 失败 ${failedBatchCount}` : ""}
                      </span>
                    </div>
                  </div>
                  {activeStoryboard && (
                    <div className="mt-3 grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3 text-sm text-[var(--text-secondary)]">
                      <p>
                        <span className="font-semibold text-[var(--text-primary)]">角色：</span>
                        {activeStoryboard.character}
                      </p>
                      <p>
                        <span className="font-semibold text-[var(--text-primary)]">动作：</span>
                        {activeStoryboard.action}
                      </p>
                      <p>
                        <span className="font-semibold text-[var(--text-primary)]">场景：</span>
                        {activeStoryboard.environment}
                      </p>
                    </div>
                  )}
                </section>

                <WorkbenchSection title="4. 分镜与提示词">
                  <StoryboardPanel
                    director={director}
                    activeShotIdx={activeShotIdx}
                    onSelectShot={selectShot}
                    onReorder={reorderShots}
                    onUpdatePrompt={updatePrompt}
                  />
                </WorkbenchSection>

                <div className="mb-4">
                  <BatchGeneratePanel
                    director={director}
                    batchRunning={batchRunning}
                    batchResults={batchResults}
                    onRunBatch={runBatch}
                    onRetryShot={retryShot}
                    onSelectShot={selectShot}
                  />
                </div>

                <WorkbenchSection title="5. 当前镜头生成 / 验收">
                  {!isPreview && (
                    <div className="mb-4">
                      <GenerationModeToggle
                        mode={mode}
                        onChange={(m: GenerationMode) => patch({ mode: m })}
                        productionDisabled={!shotLock}
                      />
                    </div>
                  )}
                  {mode === "test" || isPreview ? (
                    <div className="mb-4 flex flex-wrap gap-2">
                      <LoadingButton loading={veoLoading} loadingText="生成中…" disabled={veoLoading} onClick={runVeoTest}>
                        {previewUrl ? "重新生成预览" : `${veoDurationSec} 秒预览`}
                      </LoadingButton>
                      {!isPreview && (
                        <LoadingButton variant="secondary" disabled={veoLoading || !effectiveTestResult} onClick={lockShot}>
                          确认并锁定
                        </LoadingButton>
                      )}
                    </div>
                  ) : (
                    <div className="mb-4">
                      <LoadingButton loading={veoLoading} loadingText="正式生成中…" disabled={veoLoading || !shotLock} onClick={runVeoProduction}>
                        正式生成（{veoDurationSec} 秒）
                      </LoadingButton>
                    </div>
                  )}
                  <VeoProgressPanel status={veoStatus} step={veoProgressStep} error={veoError} successMessage={veoSuccessMessage} />
                  <VideoPreviewPanel status={veoStatus} videoUrl={previewUrl} error={veoError} />
                  {!isPreview && <ShotLockPanel lock={shotLock} onUnlock={unlockShot} />}
                </WorkbenchSection>
              </>
            )}
          </div>
        </div>

        {confirmDeleteExport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="rounded-xl bg-[var(--bg-surface)] p-6 shadow-xl">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {isExportSuccess(exportMeta)
                  ? "此项目已导出过。确认删除本地记录？"
                  : "确认删除导出记录？"}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn-secondary rounded-lg px-3 py-1.5 text-sm" onClick={() => setConfirmDeleteExport(false)}>取消</button>
                <button type="button" className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-sm text-white" onClick={deleteExportRecord}>确认删除</button>
              </div>
            </div>
          </div>
        )}

        {error && veoStatus !== "failed" && (
          <p className="mt-4 text-sm font-semibold text-[var(--danger)]">{error}</p>
        )}
      </div>
    </div>
  );
}
