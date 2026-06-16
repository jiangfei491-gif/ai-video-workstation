"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiCalendar,
  FiChevronDown,
  FiChevronUp,
  FiCpu,
  FiDollarSign,
  FiLoader,
  FiZap,
} from "react-icons/fi";

type UsageStats = {
  todayTokens: number;
  monthTokens: number;
  estimatedCost: number;
  model: string;
  successRate: number;
};

const POLL_MS = 30000;

type Props = {
  /** 折叠模式：用于热点中心等低频查看场景 */
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export default function OpenAIStatsBar({
  collapsible = false,
  defaultOpen = true,
}: Props) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(defaultOpen);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/openai/stats", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setStats({
          todayTokens: data.todayTokens ?? 0,
          monthTokens: data.monthTokens ?? 0,
          estimatedCost: data.estimatedCost ?? 0,
          model: data.model ?? "gpt-4.1",
          successRate: data.successRate ?? 100,
        });
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => {
      void fetchStats();
    }, 0);
    const timer = setInterval(() => {
      void fetchStats();
    }, POLL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [fetchStats]);

  const items = [
    { icon: FiZap, label: "今日令牌", value: loading ? "…" : (stats?.todayTokens ?? 0).toLocaleString() },
    { icon: FiCalendar, label: "本月令牌", value: loading ? "…" : (stats?.monthTokens ?? 0).toLocaleString() },
    { icon: FiDollarSign, label: "预估费用", value: loading ? "…" : `$${(stats?.estimatedCost ?? 0).toFixed(2)}` },
    { icon: FiCpu, label: "当前模型", value: loading ? "…" : (stats?.model ?? "—") },
    { icon: FiActivity, label: "成功率", value: loading ? "…" : `${stats?.successRate ?? 100}%` },
  ];

  if (collapsible) {
    return (
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-inset)]/80">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2 text-left text-xs text-[var(--text-caption)] hover:bg-[var(--bg-surface)]"
        >
          <span className="font-medium text-[var(--text-secondary)]">
            OpenAI 用量统计
            {!open && !loading && stats && (
              <span className="ml-2 font-normal text-[var(--text-caption)]">
                · 今日 {(stats.todayTokens).toLocaleString()} 令牌 · ${stats.estimatedCost.toFixed(2)}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1">
            {loading && <FiLoader className="h-3 w-3 animate-spin" />}
            {open ? <FiChevronDown className="h-3.5 w-3.5" /> : <FiChevronUp className="h-3.5 w-3.5 rotate-180" />}
          </span>
        </button>
        {open && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--border)] px-4 py-2.5">
            {items.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs">
                <Icon className="h-3 w-3 text-[var(--text-caption)]" />
                <span className="text-[var(--text-caption)]">{label}</span>
                <span className="font-medium tabular-nums text-[var(--text-secondary)]">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative z-10 shrink-0 border-b border-[var(--border)] bg-[var(--nav-bg)]/95 px-4 py-2 backdrop-blur-xl">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-caption)]">
          OpenAI 用量
        </p>
        {loading && <FiLoader className="h-3 w-3 animate-spin text-[var(--text-caption)]" />}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
        {items.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="stat-card flex items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
              {loading ? (
                <FiLoader className="h-3 w-3 animate-spin" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[10px] text-[var(--text-caption)]">{label}</p>
              <p className="truncate text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
