"use client";

import { useEffect, useRef } from "react";
import { pollEditRenderJob } from "@/app/lib/auto-edit/render-job-client";
import { useT2VWorkbenchStore } from "@/app/lib/workbench-persist/t2v-store";

/** 全局跟踪渲染任务：切页不中断轮询，完成后写回工作台 */
export default function EditRenderJobTracker() {
  const { state, patch } = useT2VWorkbenchStore();
  const pollingRef = useRef<string | null>(null);

  useEffect(() => {
    const jobId = state.editRenderJobId;
    if (!state.editRendering || !jobId) {
      pollingRef.current = null;
      return;
    }
    if (pollingRef.current === jobId) return;
    pollingRef.current = jobId;

    void pollEditRenderJob(jobId)
      .then((job) => {
        patch({
          finalEditVideoUrl: job.outputUrl ?? null,
          editRendering: false,
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

  return null;
}
