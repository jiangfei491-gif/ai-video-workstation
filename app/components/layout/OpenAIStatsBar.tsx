"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiCalendar,
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

export default function OpenAIStatsBar() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

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

  const cards = [
    {
      icon: FiZap,
      label: "今日 Token",
      value: loading ? "…" : (stats?.todayTokens ?? 0).toLocaleString(),
      accent: false,
    },
    {
      icon: FiCalendar,
      label: "本月 Token",
      value: loading ? "…" : (stats?.monthTokens ?? 0).toLocaleString(),
      accent: false,
    },
    {
      icon: FiDollarSign,
      label: "预估费用",
      value: loading ? "…" : `$${(stats?.estimatedCost ?? 0).toFixed(2)}`,
      accent: true,
    },
    {
      icon: FiCpu,
      label: "当前模型",
      value: loading ? "…" : (stats?.model ?? "—"),
      accent: false,
    },
    {
      icon: FiActivity,
      label: "请求成功率",
      value: loading ? "…" : `${stats?.successRate ?? 100}%`,
      accent: (stats?.successRate ?? 100) >= 95,
    },
  ];

  return (
    <div className="relative z-10 shrink-0 border-b border-[var(--border)] bg-[var(--nav-bg)]/95 px-4 py-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-muted)]">
          OpenAI Usage
        </p>
        {loading && <FiLoader className="h-3 w-3 animate-spin text-[var(--text-muted)]" />}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(({ icon: Icon, label, value, accent }) => (
          <div
            key={label}
            className="stat-card group flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 transition-colors hover:border-[var(--border-glow)]"
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                accent
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-[var(--accent-soft)] text-[var(--accent)]"
              }`}
            >
              {loading ? (
                <FiLoader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                {label}
              </p>
              <p className="truncate text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
