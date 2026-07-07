"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPause, FiPlay, FiRefreshCw, FiRotateCw, FiSquare } from "react-icons/fi";

type DownloadTask = {
  id: string;
  filename: string;
  remote_url: string;
  status: string;
  bytes_downloaded: number;
  bytes_total: number | null;
  speed_bps: number | null;
  local_path: string;
  error_message: string | null;
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function DownloadTasksPanel() {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/resource-center/downloads/tasks");
      const data = (await res.json()) as { tasks: DownloadTask[] };
      setTasks(data.tasks ?? []);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh({ silent: true }), 4000);
    return () => clearInterval(t);
  }, [refresh]);

  async function action(id: string, op: string) {
    await fetch(`/api/resource-center/downloads/tasks/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: op }),
    });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Downloader</h2>
          <p className="text-sm text-[var(--text-caption)]">
            下载至 storage/downloads/ · 断点续传 · Hash 校验
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} className="btn-secondary rounded-lg px-3 py-2 text-sm">
          <FiRefreshCw className="inline h-4 w-4" /> 刷新
        </button>
      </div>

      {loading && tasks.length === 0 ? (
        <p className="text-sm text-[var(--text-caption)]">加载中…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-[var(--text-caption)]">暂无下载任务。抓取完成后会自动创建下载队列。</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => {
            const pct =
              t.bytes_total && t.bytes_total > 0
                ? Math.min(100, Math.round((t.bytes_downloaded / t.bytes_total) * 100))
                : 0;
            return (
              <div key={t.id} className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{t.filename}</p>
                    <p className="text-xs text-[var(--text-caption)]">{t.status}</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={() => void action(t.id, "pause")} className="rounded border px-2 py-1">
                      <FiPause className="inline" /> 暂停
                    </button>
                    <button type="button" onClick={() => void action(t.id, "resume")} className="rounded border px-2 py-1">
                      <FiPlay className="inline" /> 恢复
                    </button>
                    <button type="button" onClick={() => void action(t.id, "retry")} className="rounded border px-2 py-1">
                      <FiRotateCw className="inline" /> 重试
                    </button>
                    <button type="button" onClick={() => void action(t.id, "cancel")} className="rounded border px-2 py-1">
                      <FiSquare className="inline" /> 取消
                    </button>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-inset)]">
                  <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  {fmtBytes(t.bytes_downloaded)}
                  {t.bytes_total ? ` / ${fmtBytes(t.bytes_total)}` : ""}
                  {t.speed_bps ? ` · ${fmtBytes(t.speed_bps)}/s` : ""}
                </p>
                {t.local_path && (
                  <p className="mt-1 truncate font-mono text-xs text-[var(--text-caption)]">{t.local_path}</p>
                )}
                {t.error_message && <p className="mt-1 text-xs text-red-400">{t.error_message}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
