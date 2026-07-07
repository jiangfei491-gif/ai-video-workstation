import type { EditRenderJob } from "./types";

export type RenderJobPollHandlers = {
  onProgress?: (pct: number, message: string) => void;
};

/** 轮询服务端渲染任务直至完成/失败（切页后可继续调用） */
export function pollEditRenderJob(
  jobId: string,
  handlers?: RenderJobPollHandlers
): Promise<EditRenderJob> {
  return new Promise((resolve, reject) => {
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/auto-edit/jobs/${jobId}`, { cache: "no-store" });
        const data = (await res.json()) as { job?: EditRenderJob; error?: string };
        if (!res.ok || !data.job) {
          throw new Error(data.error ?? "无法获取渲染进度");
        }
        const job = data.job;
        handlers?.onProgress?.(job.progress, job.message);
        if (job.status === "success") {
          stopped = true;
          resolve(job);
        } else if (job.status === "failed") {
          stopped = true;
          reject(new Error(job.error ?? job.message ?? "渲染失败"));
        } else {
          setTimeout(poll, 800);
        }
      } catch (err) {
        stopped = true;
        reject(err);
      }
    };

    void poll();
  });
}
