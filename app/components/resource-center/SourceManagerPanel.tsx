"use client";

import { useCallback, useEffect, useState } from "react";
import { FiGlobe, FiRefreshCw, FiTrash2, FiZap } from "react-icons/fi";

type Source = {
  id: string;
  name: string;
  url: string;
  resource_types: string[];
  site_category: string;
  provider_slug: string;
  enabled: boolean;
  status: string;
  supports_crawler: boolean;
  supports_downloader: boolean;
};

export default function SourceManagerPanel() {
  const [sources, setSources] = useState<Source[]>([]);
  const [stats, setStats] = useState<{ total: number; enabled: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [crawling, setCrawling] = useState<string | null>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/resource-center/sources");
      const data = (await res.json()) as { sources: Source[]; stats: { total: number; enabled: number } };
      setSources(data.sources ?? []);
      setStats(data.stats ?? null);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function testConnection(id: string) {
    setTesting(id);
    try {
      await fetch(`/api/resource-center/sources/${id}/test`, { method: "POST" });
      await refresh();
    } finally {
      setTesting(null);
    }
  }

  async function syncNow(id: string) {
    setCrawling(id);
    try {
      await fetch("/api/resource-center/scheduler/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_now", source_id: id }),
      });
    } finally {
      setCrawling(null);
    }
  }

  async function startCrawl(id: string) {
    setCrawling(id);
    try {
      await fetch("/api/resource-center/crawler/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: id }),
      });
    } finally {
      setCrawling(null);
    }
  }

  async function toggleEnabled(source: Source) {
    await fetch(`/api/resource-center/sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !source.enabled }),
    });
    await refresh();
  }

  async function remove(id: string) {
    if (!confirm("确定删除该资源站？")) return;
    await fetch(`/api/resource-center/sources/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Source Manager</h2>
          <p className="text-sm text-[var(--text-caption)]">
            资源站管理 · 共 {stats?.total ?? 0} 个（启用 {stats?.enabled ?? 0}）
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} className="btn-secondary rounded-lg px-3 py-2 text-sm">
          <FiRefreshCw className="inline h-4 w-4" /> 刷新
        </button>
      </div>

      {loading && sources.length === 0 ? (
        <p className="text-sm text-[var(--text-caption)]">加载中…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--bg-inset)] text-left text-xs text-[var(--text-caption)]">
              <tr>
                <th className="px-4 py-3">名称</th>
                <th className="px-4 py-3">类型</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">绑定库</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text-primary)]">{s.name}</div>
                    <div className="truncate text-xs text-[var(--text-caption)]">{s.url}</div>
                  </td>
                  <td className="px-4 py-3">{s.site_category}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.provider_slug}</td>
                  <td className="px-4 py-3 text-xs">{s.resource_types.join(", ")}</td>
                  <td className="px-4 py-3">
                    <span className={s.enabled ? "text-[var(--success)]" : "text-[var(--text-caption)]"}>
                      {s.enabled ? s.status : "disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={testing === s.id}
                        onClick={() => void testConnection(s.id)}
                        className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                      >
                        <FiGlobe className="inline h-3 w-3" /> 测试
                      </button>
                      {s.supports_crawler && (
                        <>
                          <button
                            type="button"
                            disabled={crawling === s.id || !s.enabled}
                            onClick={() => void startCrawl(s.id)}
                            className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                          >
                            <FiZap className="inline h-3 w-3" /> 抓取
                          </button>
                          <button
                            type="button"
                            disabled={crawling === s.id || !s.enabled}
                            onClick={() => void syncNow(s.id)}
                            className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                          >
                            立即同步
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => void toggleEnabled(s)}
                        className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                      >
                        {s.enabled ? "禁用" : "启用"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(s.id)}
                        className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-400"
                      >
                        <FiTrash2 className="inline h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
