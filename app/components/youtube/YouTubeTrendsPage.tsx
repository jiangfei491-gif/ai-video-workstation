"use client";

import { useState } from "react";
import { FiLoader, FiSearch, FiYoutube } from "react-icons/fi";
import OpenAIStatsBar from "@/app/components/layout/OpenAIStatsBar";

type VideoItem = {
  id: string;
  title: string;
  views: number;
  channel: string;
};

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function YouTubeTrendsPage() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<VideoItem[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState("");
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [source, setSource] = useState("");

  const handleSearch = async () => {
    const q = keyword.trim();
    if (!q) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/youtube/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: q }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "请求失败");
      setItems(data.items ?? []);
      setPatterns(data.patterns ?? []);
      setAnalysis(data.analysis ?? "");
      setGeneratedTitles(data.generatedTitles ?? []);
      setSource(data.source ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <OpenAIStatsBar />
      <div className="workspace-shell relative flex-1 overflow-y-auto">
        <div className="workspace-bg" aria-hidden>
          <div className="workspace-bg__orb workspace-bg__orb--2" />
          <div className="workspace-bg__grid" />
        </div>
        <div className="relative z-10 mx-auto max-w-5xl p-6">
          <header className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
              <FiYoutube className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                YouTube Trends
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                热门标题分析 · AI 规律总结 · 标题生成
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
                placeholder="输入关键词，如：ChatGPT tutorial"
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
                分析热门标题
              </button>
            </div>
            {source && (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                数据来源：{source === "youtube-api" ? "YouTube Data API" : "AI 趋势模拟"}
              </p>
            )}
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          </div>

          {items.length > 0 && (
            <div className="glass-card mb-6 rounded-2xl p-5">
              <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
                热门视频标题 ({items.length})
              </h2>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] p-4"
                  >
                    <div className="mb-1 text-xs text-[var(--text-muted)]">
                      #{i + 1} · {item.channel}
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      👁 {formatNum(item.views)} views
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {patterns.length > 0 && (
            <div className="glass-card mb-6 rounded-2xl p-5">
              <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
                爆款规律
              </h2>
              <ul className="list-inside list-disc space-y-1 text-sm text-[var(--text-secondary)]">
                {patterns.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis && (
            <div className="glass-card mb-6 rounded-2xl p-5">
              <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                AI 规律总结
              </h2>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {analysis}
              </p>
            </div>
          )}

          {generatedTitles.length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
                AI 生成类似标题
              </h2>
              <div className="space-y-2">
                {generatedTitles.map((t, i) => (
                  <div
                    key={t}
                    className="rounded-lg border border-[var(--border-glow)] bg-[var(--accent-soft)] px-4 py-2.5 text-sm text-[var(--text-secondary)]"
                  >
                    {i + 1}. {t}
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
