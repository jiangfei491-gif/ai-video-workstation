"use client";

import { useState } from "react";
import { FiLoader, FiSearch, FiTrendingUp } from "react-icons/fi";
import { FaTiktok } from "react-icons/fa";
import OpenAIStatsBar from "@/app/components/layout/OpenAIStatsBar";

type TrendItem = {
  id: string;
  title: string;
  likes: number;
  views: number;
  author: string;
};

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function TikTokTrendsPage() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<TrendItem[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState("");

  const handleSearch = async () => {
    const q = keyword.trim();
    if (!q) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tiktok/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: q }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "请求失败");
      setItems(data.items ?? []);
      setKeywords(data.keywords ?? []);
      setAnalysis(data.analysis ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "抓取失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <OpenAIStatsBar />
      <div className="workspace-shell relative flex-1 overflow-y-auto">
        <div className="workspace-bg" aria-hidden>
          <div className="workspace-bg__orb workspace-bg__orb--1" />
          <div className="workspace-bg__grid" />
        </div>
        <div className="relative z-10 mx-auto max-w-5xl p-6">
          <header className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <FaTiktok className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                TikTok Trends
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                爆款标题抓取 · AI 关键词分析
              </p>
            </div>
          </header>

          <div className="glass-card mb-6 rounded-2xl p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="输入关键词，如：职场效率、AI工具"
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-glow)]"
              />
              <button
                type="button"
                disabled={loading || !keyword.trim()}
                onClick={handleSearch}
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {loading ? (
                  <FiLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <FiSearch className="h-4 w-4" />
                )}
                抓取热门标题
              </button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-400">{error}</p>
            )}
          </div>

          {keywords.length > 0 && (
            <div className="glass-card mb-6 rounded-2xl p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <FiTrendingUp className="h-4 w-4 text-[var(--accent)]" />
                爆款关键词
              </h2>
              <div className="flex flex-wrap gap-2">
                {keywords.map((k) => (
                  <span
                    key={k}
                    className="rounded-full border border-[var(--border-glow)] bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--accent)]"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis && (
            <div className="glass-card mb-6 rounded-2xl p-5">
              <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                AI 爆款分析
              </h2>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {analysis}
              </p>
            </div>
          )}

          {items.length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
                热门标题 ({items.length})
              </h2>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] p-4"
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <span className="text-xs text-[var(--text-muted)]">#{i + 1}</span>
                      <span className="text-xs text-[var(--text-muted)]">{item.author}</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {item.title}
                    </p>
                    <div className="mt-2 flex gap-4 text-xs text-[var(--text-muted)]">
                      <span>❤️ {formatNum(item.likes)}</span>
                      <span>▶ {formatNum(item.views)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
