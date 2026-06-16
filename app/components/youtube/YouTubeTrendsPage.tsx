"use client";

import { useState } from "react";
import { FiLoader, FiSearch } from "react-icons/fi";

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

  const hasResults =
    items.length > 0 || patterns.length > 0 || analysis || generatedTitles.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
        <p className="mb-2 text-xs text-[var(--text-caption)]">
          YouTube · 热门标题分析 · 智能规律总结
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="输入关键词，如：ChatGPT 教程"
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
        {source && (
          <p className="mt-1.5 text-xs text-[var(--text-caption)]">
            数据来源：{source === "youtube-api" ? "YouTube 数据接口" : "智能趋势模拟"}
          </p>
        )}
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
            正在分析热门标题…
          </div>
        )}

        {analysis && (
          <section className="glass-panel mb-3 rounded-xl p-4">
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">智能规律总结</h2>
            <p className="workbench-body text-sm leading-relaxed">{analysis}</p>
          </section>
        )}

        {patterns.length > 0 && (
          <section className="glass-panel mb-3 rounded-xl p-4">
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">爆款规律</h2>
            <ul className="list-inside list-disc space-y-1 text-sm text-[var(--text-body)]">
              {patterns.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        )}

        {generatedTitles.length > 0 && (
          <section className="glass-panel mb-3 rounded-xl p-4">
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
              智能生成类似标题
            </h2>
            <div className="space-y-2">
              {generatedTitles.map((t, i) => (
                <div
                  key={t}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-sm text-[var(--text-body)]"
                >
                  {i + 1}. {t}
                </div>
              ))}
            </div>
          </section>
        )}

        {items.length > 0 && (
          <section className="glass-panel rounded-xl p-4">
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
              热门视频标题 ({items.length})
            </h2>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3"
                >
                  <div className="mb-1 text-xs text-[var(--text-caption)]">
                    #{i + 1} · {item.channel}
                  </div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-caption)]">
                    👁 {formatNum(item.views)} 次播放
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
