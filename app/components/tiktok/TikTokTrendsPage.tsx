"use client";

import { useState } from "react";
import { FiLoader, FiSearch, FiTrendingUp } from "react-icons/fi";

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

  const hasResults = keywords.length > 0 || analysis || items.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
        <p className="mb-2 text-xs text-[var(--text-caption)]">抖音/TikTok · 爆款标题抓取 · 智能关键词分析</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="输入关键词，如：职场效率、智能工具"
            className="input-field min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
            autoFocus
          />
          <button
            type="button"
            disabled={loading || !keyword.trim()}
            onClick={handleSearch}
            className="btn-primary inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {loading ? (
              <FiLoader className="h-4 w-4 animate-spin" />
            ) : (
              <FiSearch className="h-4 w-4" />
            )}
            {loading ? "分析中…" : "分析"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {!hasResults && !loading && (
          <p className="text-sm text-[var(--text-caption)]">
            输入关键词并点击「分析」，结果将显示在下方。
          </p>
        )}

        {loading && (
          <div className="flex items-center gap-2 py-4 text-sm text-[var(--text-secondary)]">
            <FiLoader className="h-4 w-4 animate-spin text-[var(--accent)]" />
            正在抓取热门标题并生成智能分析…
          </div>
        )}

        {keywords.length > 0 && (
          <section className="glass-panel mb-3 rounded-xl p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <FiTrendingUp className="h-4 w-4 text-[var(--accent)]" />
              爆款关键词
            </h2>
            <div className="flex flex-wrap gap-2">
              {keywords.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-[var(--border-glow)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]"
                >
                  {k}
                </span>
              ))}
            </div>
          </section>
        )}

        {analysis && (
          <section className="glass-panel mb-3 rounded-xl p-4">
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">智能爆款分析</h2>
            <p className="workbench-body text-sm leading-relaxed">{analysis}</p>
          </section>
        )}

        {items.length > 0 && (
          <section className="glass-panel rounded-xl p-4">
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
              热门标题 ({items.length})
            </h2>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3"
                >
                  <div className="mb-1 flex items-start justify-between gap-2 text-xs text-[var(--text-caption)]">
                    <span>#{i + 1}</span>
                    <span>{item.author}</span>
                  </div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                  <div className="mt-1.5 flex gap-4 text-xs text-[var(--text-caption)]">
                    <span>❤️ {formatNum(item.likes)}</span>
                    <span>▶ {formatNum(item.views)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
