"use client";

import { useCallback, useEffect, useState } from "react";
import { FiActivity, FiPause, FiPlay, FiRefreshCw, FiZap } from "react-icons/fi";

type Dashboard = {
  paused: boolean;
  runningCrawlers: number;
  waitingCrawlers: number;
  runningDownloads: number;
  waitingDownloads: number;
  runningAnalysis: number;
  waitingAnalysis: number;
  crawlSpeedPerHour: number;
  downloadSpeedBps: number;
  analysisSpeedPerHour: number;
  crawledTotal: number;
  failedTotal: number;
  successTotal: number;
  estimatedCompletionAt: string | null;
  activeTasks: Array<{
    id: string;
    type: string;
    sourceId?: string;
    status: string;
    progress?: string;
  }>;
};

type GlobalConfig = {
  autoCrawlEnabled: boolean;
  downloadConcurrency: number;
  analysisConcurrency: number;
  failureRetries: number;
  crawlTimeoutSec: number;
  pollingStrategy: string;
  logRetentionDays: number;
};

function fmtSpeed(bps: number): string {
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
}

export default function SchedulerDashboardPanel() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/resource-center/scheduler");
      const data = (await res.json()) as {
        dashboard: Dashboard;
        config: GlobalConfig;
        paused: boolean;
      };
      setDashboard(data.dashboard);
      setConfig(data.config);
      setPaused(data.paused);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh({ silent: true }), 5000);
    return () => clearInterval(t);
  }, [refresh]);

  async function action(op: "pause" | "resume") {
    await fetch("/api/resource-center/scheduler/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: op }),
    });
    await refresh({ silent: true });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Scheduler Dashboard</h2>
          <p className="text-sm text-[var(--text-caption)]">
            抓取调度器 · 自动/手动 · 优先级轮询 · 并发控制 · 监控
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void refresh()} className="btn-secondary rounded-lg px-3 py-2 text-sm">
            <FiRefreshCw className="inline h-4 w-4" /> 刷新
          </button>
          {paused ? (
            <button type="button" onClick={() => void action("resume")} className="btn-secondary rounded-lg px-3 py-2 text-sm">
              <FiPlay className="inline h-4 w-4" /> 恢复调度
            </button>
          ) : (
            <button type="button" onClick={() => void action("pause")} className="btn-secondary rounded-lg px-3 py-2 text-sm">
              <FiPause className="inline h-4 w-4" /> 暂停调度
            </button>
          )}
        </div>
      </div>

      {loading && !dashboard ? (
        <p className="text-sm text-[var(--text-caption)]">加载中…</p>
      ) : dashboard ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["运行中抓取", dashboard.runningCrawlers],
              ["等待抓取", dashboard.waitingCrawlers],
              ["运行中下载", dashboard.runningDownloads],
              ["等待下载", dashboard.waitingDownloads],
              ["运行中分析", dashboard.runningAnalysis],
              ["等待分析", dashboard.waitingAnalysis],
              ["成功", dashboard.successTotal],
              ["失败", dashboard.failedTotal],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-4 py-3">
                <p className="text-xs text-[var(--text-caption)]">{label}</p>
                <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{value}</p>
              </div>
            ))}
          </div>

          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] p-4 text-sm">
              <p className="text-[var(--text-caption)]">抓取速度</p>
              <p className="mt-1 font-semibold">{dashboard.crawlSpeedPerHour} 次/小时</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4 text-sm">
              <p className="text-[var(--text-caption)]">下载速度</p>
              <p className="mt-1 font-semibold">{fmtSpeed(dashboard.downloadSpeedBps)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4 text-sm">
              <p className="text-[var(--text-caption)]">分析速度</p>
              <p className="mt-1 font-semibold">{dashboard.analysisSpeedPerHour} 项/小时</p>
            </div>
          </section>

          {dashboard.estimatedCompletionAt && (
            <p className="text-xs text-[var(--text-caption)]">
              预计完成：{new Date(dashboard.estimatedCompletionAt).toLocaleString("zh-CN")}
            </p>
          )}

          {config && (
            <section className="rounded-xl border border-[var(--border)] p-4 text-xs text-[var(--text-secondary)]">
              <p className="mb-2 font-semibold text-[var(--text-primary)]">全局配置</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>自动抓取：{config.autoCrawlEnabled ? "开" : "关"}</span>
                <span>下载并发：{config.downloadConcurrency}</span>
                <span>分析并发：{config.analysisConcurrency}</span>
                <span>失败重试：{config.failureRetries}</span>
                <span>超时：{config.crawlTimeoutSec}s</span>
                <span>轮询：{config.pollingStrategy}</span>
                <span>日志保留：{config.logRetentionDays}天</span>
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <FiActivity className="h-4 w-4" /> 当前任务
            </h3>
            {dashboard.activeTasks.length === 0 ? (
              <p className="text-sm text-[var(--text-caption)]">暂无运行任务</p>
            ) : (
              <div className="space-y-2">
                {dashboard.activeTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs">
                    <FiZap className="h-3 w-3 text-[var(--accent)]" />
                    <span className="font-medium">{t.type}</span>
                    <span>{t.status}</span>
                    {t.progress && <span className="text-[var(--text-caption)]">{t.progress}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
