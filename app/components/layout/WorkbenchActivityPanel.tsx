"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  FiActivity,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiLoader,
  FiXCircle,
} from "react-icons/fi";
import {
  countRunningActivities,
  startWorkbenchActivityPolling,
  stopWorkbenchActivityPolling,
  useWorkbenchActivity,
} from "@/app/lib/workbench-activity/client-store";
import type { WorkbenchActivityEntry, WorkbenchActivityStatus } from "@/app/lib/workbench-activity/types";
import { installWorkbenchFetchTracker } from "@/app/lib/workbench-activity/fetch-tracker";
import { useUiState } from "@/app/lib/ui-state/store";

function statusIcon(status: WorkbenchActivityStatus) {
  if (status === "running") return <FiLoader className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />;
  if (status === "success") return <FiCheckCircle className="h-3.5 w-3.5 text-[var(--success)]" />;
  if (status === "failed") return <FiXCircle className="h-3.5 w-3.5 text-red-400" />;
  return <FiActivity className="h-3.5 w-3.5 text-[var(--text-caption)]" />;
}

function statusLabel(status: WorkbenchActivityStatus): string {
  if (status === "running") return "进行中";
  if (status === "success") return "已完成";
  if (status === "failed") return "失败";
  if (status === "skipped") return "已跳过";
  return "信息";
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

function ActivityRow({ row }: { row: WorkbenchActivityEntry }) {
  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-0.5 border-b border-[var(--border)] px-3 py-2 text-xs last:border-b-0 ${
        row.status === "running" ? "bg-[var(--accent)]/5" : ""
      }`}
    >
      <div className="pt-0.5">{statusIcon(row.status)}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-medium text-[var(--text-primary)]">{row.moduleLabel}</span>
          <span className="text-[10px] text-[var(--text-caption)]">{row.actor}</span>
          <span
            className={`rounded px-1 py-0.5 text-[10px] ${
              row.status === "running"
                ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                : row.status === "success"
                  ? "bg-[var(--success)]/10 text-[var(--success)]"
                  : row.status === "failed"
                    ? "bg-red-500/10 text-red-400"
                    : "bg-[var(--bg-inset)] text-[var(--text-caption)]"
            }`}
          >
            {statusLabel(row.status)}
          </span>
        </div>
        <p className="mt-0.5 text-[var(--text-secondary)]">{row.message}</p>
        {row.detail && (
          <p className="mt-0.5 truncate text-[10px] text-[var(--text-caption)]">{row.detail}</p>
        )}
      </div>
      <span className="shrink-0 pt-0.5 font-mono text-[10px] text-[var(--text-caption)]">
        {formatTime(row.updatedAt)}
      </span>
    </div>
  );
}

export default function WorkbenchActivityPanel() {
  const { state: ui, patch } = useUiState();
  const activities = useWorkbenchActivity();
  const logScrollRef = useRef<HTMLDivElement>(null);
  const prevActivityCountRef = useRef(0);

  const runningCount = useMemo(() => countRunningActivities(activities), [activities]);

  useEffect(() => {
    const nativeFetch = installWorkbenchFetchTracker();
    startWorkbenchActivityPolling(nativeFetch);
    return () => stopWorkbenchActivityPolling();
  }, []);

  useEffect(() => {
    if (!ui.activityPanelOpen || runningCount === 0) {
      prevActivityCountRef.current = activities.length;
      return;
    }
    const el = logScrollRef.current;
    if (!el || activities.length <= prevActivityCountRef.current) {
      prevActivityCountRef.current = activities.length;
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
    prevActivityCountRef.current = activities.length;
  }, [activities.length, runningCount, ui.activityPanelOpen]);

  const latestRunning = activities.find((a) => a.status === "running");

  return (
    <div
      className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)]"
      style={{ height: ui.activityPanelOpen ? ui.activityPanelHeight : 40 }}
    >
      <button
        type="button"
        onClick={() => patch({ activityPanelOpen: !ui.activityPanelOpen })}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs hover:bg-[var(--bg-inset)]"
      >
        <FiActivity className="h-4 w-4 shrink-0 text-[var(--accent)]" />
        <span className="font-semibold text-[var(--text-primary)]">工作台动态</span>
        {runningCount > 0 && (
          <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
            {runningCount} 进行中
          </span>
        )}
        {!ui.activityPanelOpen && latestRunning && (
          <span className="truncate text-[var(--text-caption)]">
            · {latestRunning.moduleLabel}：{latestRunning.message}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-[var(--text-caption)]">
          {!ui.activityPanelOpen && activities.length > 0 && (
            <span>{activities.length} 条记录</span>
          )}
          {ui.activityPanelOpen ? (
            <FiChevronDown className="h-4 w-4" />
          ) : (
            <FiChevronUp className="h-4 w-4" />
          )}
        </span>
      </button>

      {ui.activityPanelOpen && (
        <div className="flex h-[calc(100%-40px)] flex-col border-t border-[var(--border)]">
          <div className="flex shrink-0 items-center justify-between px-3 py-1.5 text-[10px] text-[var(--text-caption)]">
            <span>全站任务实时动态 · 谁在干什么 · 是否完成</span>
            <label className="inline-flex items-center gap-1">
              高度
              <input
                type="range"
                min={120}
                max={360}
                value={ui.activityPanelHeight}
                onChange={(e) => patch({ activityPanelHeight: Number(e.target.value) })}
                className="w-20"
              />
            </label>
          </div>
          <div ref={logScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[var(--bg-inset)]/40">
            {activities.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-[var(--text-caption)]">
                暂无动态。运行编导、配音、剪辑、质检等任务后，这里会实时显示进度。
              </p>
            ) : (
              activities.map((row) => <ActivityRow key={row.id} row={row} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
