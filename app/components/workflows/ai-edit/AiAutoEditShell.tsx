"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { FiDownload, FiPlay, FiRefreshCw, FiSliders } from "react-icons/fi";
import { getT2VState, useT2VWorkbenchStore } from "@/app/lib/workbench-persist/t2v-store";
import { graphToSequence, refreshEditGraphFromWorkbench } from "@/app/lib/auto-edit";
import { pollEditRenderJob } from "@/app/lib/auto-edit/render-job-client";
import type { AutoEditStepResult } from "@/app/lib/auto-edit/run-auto-edit-pipeline";
import {
  isDirectorPlanStale,
  isEditGraphStale,
} from "@/app/lib/ai-director/downstream-stale";
import {
  buildVoicePreviewSources,
  resolveScrubVideoAtPlayhead,
  resolveSubtitleAtPlayhead,
} from "@/app/lib/auto-edit/timeline-preview";
import { mergeEditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";
import LoadingButton from "@/app/components/workflows/shared/LoadingButton";
import EditRenderProgressPanel from "@/app/components/workflows/canvas/EditRenderProgressPanel";
import WorkbenchPipelineNav from "./WorkbenchPipelineNav";
import AiAutoEditStatusPanel from "./AiAutoEditStatusPanel";

const PreviewPanel = dynamic(
  () => import("@/app/components/workflows/canvas/edit-center/PreviewPanel"),
  { ssr: false }
);

export default function AiAutoEditShell() {
  const { state, patch } = useT2VWorkbenchStore();
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [steps, setSteps] = useState<AutoEditStepResult[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [renderProgress, setRenderProgress] = useState({ pct: 0, message: "" });

  const director = state.director;
  const graph = state.editGraph;
  const shotCount = director?.storyboard?.length ?? 0;
  const clipCount = graph?.timeline?.video?.length ?? 0;
  const editStale = isEditGraphStale(state);
  const planStale = isDirectorPlanStale(state);
  const playheadSec = state.canvasUi.playheadSec;
  const engineSettings = state.editEngineSettings ?? mergeEditEngineSettings();

  const previewFrameUrl = useMemo(() => {
    const idx = state.activeShotIdx ?? 0;
    if (idx < 0) return state.editCoverImageUrl;
    return (
      state.batchResults[idx]?.firstFrameUrl ??
      state.shotFrames[idx] ??
      state.editCoverImageUrl ??
      null
    );
  }, [state.activeShotIdx, state.batchResults, state.shotFrames, state.editCoverImageUrl]);

  const voiceSources = useMemo(
    () => (graph ? buildVoicePreviewSources(graph.timeline.voice, graph.mediaPool) : []),
    [graph]
  );

  const subtitleText = useMemo(
    () => (graph ? resolveSubtitleAtPlayhead(graph.timeline.subtitle, playheadSec) : null),
    [graph, playheadSec]
  );

  const scrubVideo = useMemo(
    () =>
      graph
        ? resolveScrubVideoAtPlayhead(graph.timeline.video, state.batchResults, playheadSec)
        : null,
    [graph, state.batchResults, playheadSec]
  );

  const setPlayheadSec = useCallback(
    (sec: number) => patch({ canvasUi: { ...state.canvasUi, playheadSec: sec } }),
    [patch, state.canvasUi]
  );

  const runAutoPipeline = useCallback(async () => {
    setPipelineRunning(true);
    setSteps([]);
    setStatusMessage("AI 导演正在编排剪辑工程…");
    patch({ editError: null });
    try {
      const res = await fetch("/api/auto-edit/auto-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workbench: getT2VState() }),
      });
      const data = (await res.json()) as {
        steps?: AutoEditStepResult[];
        workbenchPatch?: Record<string, unknown>;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "自动剪辑失败");
      if (data.steps) setSteps(data.steps);
      if (data.workbenchPatch) patch(data.workbenchPatch);
      setStatusMessage("剪辑工程已就绪，可导出成片");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patch({ editError: msg });
      setStatusMessage(msg);
    } finally {
      setPipelineRunning(false);
    }
  }, [patch]);

  const syncFromDirector = useCallback(async () => {
    setSyncing(true);
    setStatusMessage("正在从当前分镜同步剪辑工程…");
    patch({ editError: null });
    try {
      const cur = getT2VState();
      const next = refreshEditGraphFromWorkbench(cur);
      if (!next) throw new Error("无法从分镜生成剪辑工程，请确认编导分镜已就绪");

      const workbenchPatch: Record<string, unknown> = {
        editGraph: next,
        editSequence: graphToSequence(next),
      };
      if (planStale) {
        workbenchPatch.directorPlan = null;
        workbenchPatch.openCutCommands = null;
      }
      patch(workbenchPatch);

      const clips = next.timeline.video.length;
      const shots = cur.director?.storyboard?.length ?? 0;
      setStatusMessage(`已同步 · 时间线 ${clips} 镜（当前分镜 ${shots} 镜）`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patch({ editError: msg });
      setStatusMessage(msg);
    } finally {
      setSyncing(false);
    }
  }, [patch, planStale]);

  const runExport = useCallback(async () => {
    let seq = graph ? graphToSequence(graph) : null;
    if (!seq) {
      const refreshed = refreshEditGraphFromWorkbench(getT2VState());
      if (refreshed) {
        patch({ editGraph: refreshed });
        seq = graphToSequence(refreshed);
      }
    }
    if (!seq) {
      patch({ editError: "请先运行「一键 AI 剪辑」" });
      return;
    }

    patch({ editRendering: true, editError: null, finalEditVideoUrl: null });
    setRenderProgress({ pct: 0, message: "正在导出视频…" });
    try {
      const res = await fetch("/api/auto-edit/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workbench: getT2VState(),
          sequence: seq,
          mode: state.editRenderMode,
        }),
      });
      const data = (await res.json()) as { jobId?: string; error?: string };
      if (!res.ok || !data.jobId) throw new Error(data.error ?? "导出启动失败");

      patch({ editRenderJobId: data.jobId });
      const job = await pollEditRenderJob(data.jobId, {
        onProgress: (pct, message) => setRenderProgress({ pct, message }),
      });

      patch({
        finalEditVideoUrl: job.outputUrl ?? null,
        editRendering: false,
        editError: job.outputUrl ? null : "渲染完成但未生成视频地址",
      });
    } catch (err) {
      patch({
        editRendering: false,
        editError: err instanceof Error ? err.message : String(err),
      });
    }
  }, [graph, patch, state.editRenderMode]);

  const durationSec = graph?.timeline.durationSec ?? 0;
  const projectTitle = director?.title ?? "未命名项目";

  if (!director?.storyboard?.length) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <WorkbenchPipelineNav />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-[var(--text-secondary)]">请先完成 AI 编导与分镜，再使用 AI 剪辑</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/ai-video" className="btn-primary rounded-lg px-4 py-2 text-sm">
              去 AI 脚本 / 生成
            </Link>
            <Link href="/canvas" className="btn-secondary rounded-lg px-4 py-2 text-sm">
              去 AI 分镜
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--bg-inset)]">
      <WorkbenchPipelineNav />

      <div className="mx-auto flex w-full max-w-4xl min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
        <header className="shrink-0">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{projectTitle}</h1>
          <p className="mt-0.5 text-xs text-[var(--text-caption)]">
            AI 导演 · 默认一键完成 · 无需进入时间线
            {clipCount > 0 && (
              <span className="ml-2 text-[var(--text-secondary)]">
                · 时间线 {clipCount} 镜 / 分镜 {shotCount} 镜
              </span>
            )}
          </p>
        </header>

        {(editStale || planStale) && (
          <div className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-xs text-[var(--text-secondary)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-amber-700 dark:text-amber-300">
                {editStale && clipCount !== shotCount
                  ? `剪辑时间线（${clipCount} 镜）与当前分镜（${shotCount} 镜）不一致`
                  : "编导分镜已更新，剪辑工程可能仍是旧内容"}
              </p>
              <LoadingButton
                variant="secondary"
                loading={syncing}
                loadingText="同步中…"
                onClick={() => void syncFromDirector()}
                className="!px-3 !py-1.5 text-xs"
              >
                <FiRefreshCw className="h-3.5 w-3.5" />
                同步分镜
              </LoadingButton>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-caption)]">
              「同步分镜」按当前分镜重建时间线与旁白；需要 AI 重新编排转场/配音时请点「一键 AI 剪辑」。
            </p>
          </div>
        )}

        {/* ① 视频预览 */}
        <section className="shrink-0 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)]">
          <div className="h-[min(52vh,420px)] min-h-[240px]">
            <PreviewPanel
              playerTitle="视频预览"
              finalEditVideoUrl={state.finalEditVideoUrl}
              editRendering={state.editRendering}
              renderProgress={renderProgress}
              playheadSec={playheadSec}
              durationSec={durationSec}
              currentLabel={director.title}
              previewFrameUrl={previewFrameUrl}
              scrubVideoUrl={scrubVideo?.videoUrl ?? null}
              scrubVideoOffsetSec={scrubVideo?.clipOffsetSec ?? 0}
              voiceSources={voiceSources}
              subtitleText={subtitleText}
              bgmUrl={state.editBgmUrl}
              bgmVolume={state.editBgmVolume}
              duckUnderVoice={engineSettings.music.duckUnderVoice}
              duckAmount={engineSettings.music.duckAmount}
              onSeek={setPlayheadSec}
            />
          </div>
        </section>

        {/* ② AI 剪辑状态 */}
        <AiAutoEditStatusPanel
          steps={steps}
          running={pipelineRunning}
          currentMessage={statusMessage}
        />

        {state.editRendering && (
          <>
            <EditRenderProgressPanel progress={renderProgress.pct} message={renderProgress.message} />
            {renderProgress.pct >= 92 && renderProgress.pct < 100 && (
              <p className="text-[11px] text-[var(--text-caption)]">
                最终编码阶段 CPU 占用高、耗时较长，进度可能停在 92% 附近；可切到其他页面，后台会继续渲染。
              </p>
            )}
          </>
        )}

        {state.editError && (
          <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
            {state.editError}
          </p>
        )}

        {/* ③ 导出 ④ 高级编辑 */}
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <LoadingButton
            variant="secondary"
            loading={syncing}
            loadingText="同步中…"
            onClick={() => void syncFromDirector()}
            className="flex-1"
            title="从当前编导分镜重建剪辑时间线"
          >
            <FiRefreshCw className="h-4 w-4" />
            同步分镜
          </LoadingButton>
          <LoadingButton
            variant="primary"
            loading={pipelineRunning}
            loadingText="AI 剪辑中…"
            onClick={() => void runAutoPipeline()}
            className="flex-1"
          >
            <FiPlay className="h-4 w-4" />
            一键 AI 剪辑
          </LoadingButton>
          <LoadingButton
            variant="secondary"
            loading={state.editRendering}
            loadingText={`导出中 ${Math.round(renderProgress.pct)}%`}
            onClick={() => void runExport()}
            className="flex-1"
          >
            <FiDownload className="h-4 w-4" />
            导出视频
          </LoadingButton>
          <Link
            href="/ai-edit/advanced"
            className="btn-secondary inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
          >
            <FiSliders className="h-4 w-4" />
            高级编辑
          </Link>
        </div>

        {state.finalEditVideoUrl && !state.editRendering && (
          <a
            href={state.finalEditVideoUrl}
            download
            className="btn-primary block rounded-lg py-2.5 text-center text-sm font-medium"
          >
            下载成片
          </a>
        )}
      </div>
    </div>
  );
}
