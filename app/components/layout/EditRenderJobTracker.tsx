"use client";

import { useEffect, useRef, useState } from "react";
import { FiLoader, FiX } from "react-icons/fi";
import {
  fetchActiveEditRenderJob,
  pollEditRenderJob,
} from "@/app/lib/auto-edit/render-job-client";
import { getT2VState, useT2VWorkbenchStore } from "@/app/lib/workbench-persist/t2v-store";
import EditRenderProgressPanel from "@/app/components/workflows/canvas/EditRenderProgressPanel";

/** 全局跟踪渲染任务：切页不中断轮询，完成后写回工作台 */
export default function EditRenderJobTracker() {
  const { state, patch } = useT2VWorkbenchStore();
  const pollingRef = useRef<string | null>(null);
  const recoveredRef = useRef(false);
  const [dismissed, setDismissed] = useState(false);

  const progress = state.editRenderProgress ?? { pct: 0, message: "渲染引擎准备中…" };
  const showBar = state.editRendering && !dismissed;

  // 刷新后 editRendering 会被 clearTransientLoadingFlags 清掉，从服务端恢复进行中的任务
  useEffect(() => {
    if (recoveredRef.current) return;
    recoveredRef.current = true;

    void (async () => {
      try {
        const job = await fetchActiveEditRenderJob();
        if (!job) return;
        const cur = getT2VState();
        if (cur.editRendering && cur.editRenderJobId === job.id) return;
        patch({
          editRendering: true,
          editRenderJobId: job.id,
          editRenderProgress: { pct: job.progress, message: job.message },
          editError: null,
        });
      } catch {
        /* ignore recovery errors */
      }
    })();
  }, [patch]);

  useEffect(() => {
    if (!state.editRendering) setDismissed(false);
  }, [state.editRendering]);

  useEffect(() => {
    const jobId = state.editRenderJobId;
    if (!state.editRendering || !jobId) {
      pollingRef.current = null;
      return;
    }
    if (pollingRef.current === jobId) return;
    pollingRef.current = jobId;

    void pollEditRenderJob(jobId, {
      onProgress: (pct, message) => {
        patch({ editRenderProgress: { pct, message } });
      },
    })
      .then((job) => {
        patch({
          finalEditVideoUrl: job.outputUrl ?? null,
          editRendering: false,
          editRenderProgress: { pct: 100, message: job.message },
          editError: job.outputUrl ? null : "渲染完成但未生成视频地址",
        });
      })
      .catch((err) => {
        patch({
          editRendering: false,
          editError: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        if (pollingRef.current === jobId) pollingRef.current = null;
      });
  }, [state.editRendering, state.editRenderJobId, patch]);

  if (!showBar && !state.editError) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex justify-center p-4">
      <div className="pointer-events-auto w-full max-w-lg space-y-2">
        {showBar && (
          <div className="relative rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)]/95 p-1 shadow-lg backdrop-blur-md">
            <button
              type="button"
              aria-label="收起进度条（后台继续渲染）"
              className="absolute right-2 top-2 rounded p-1 text-[var(--text-caption)] hover:bg-[var(--bg-inset)]"
              onClick={() => setDismissed(true)}
            >
              <FiX className="h-4 w-4" />
            </button>
            <EditRenderProgressPanel progress={progress.pct} message={progress.message} />
            {progress.pct >= 12 && progress.pct < 45 && (
              <p className="px-4 pb-2 text-[11px] text-[var(--text-caption)]">
                批量配音中，进度可能较慢；可切换页面，右下角会继续更新。
              </p>
            )}
          </div>
        )}
        {state.editError && !state.editRendering && (
          <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-4 py-3 text-xs text-[var(--danger)] shadow-lg">
            <span className="inline-flex items-center gap-2 font-medium">
              <FiLoader className="h-3.5 w-3.5" />
              渲染失败
            </span>
            <p className="mt-1 leading-relaxed">{state.editError}</p>
          </div>
        )}
      </div>
    </div>
  );
}
