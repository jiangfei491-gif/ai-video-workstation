"use client";

import { useCallback, useEffect, useState } from "react";
import { FiDatabase, FiRefreshCw } from "react-icons/fi";

type ImportTask = {
  id: string;
  library_id: string;
  status: string;
  library_item_id: string | null;
  error_message: string | null;
};

type LibraryItem = {
  id: string;
  library_id: string;
  title: string;
  category: string;
  tags: string[];
  quality_score: number | null;
  local_path: string;
  status: string;
};

export default function LibraryIngestPanel() {
  const [imports, setImports] = useState<ImportTask[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/resource-center/import/tasks");
      const data = (await res.json()) as { importTasks: ImportTask[]; libraryItems: LibraryItem[] };
      setImports(data.importTasks ?? []);
      setItems(data.libraryItems ?? []);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh({ silent: true }), 8000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Library Manager</h2>
          <p className="text-sm text-[var(--text-caption)]">
            自动入库 · storage/downloads → storage/library · 搜索索引 · 统计
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} className="btn-secondary rounded-lg px-3 py-2 text-sm">
          <FiRefreshCw className="inline h-4 w-4" /> 刷新
        </button>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">入库任务</h3>
        {loading && imports.length === 0 ? (
          <p className="text-sm text-[var(--text-caption)]">加载中…</p>
        ) : imports.length === 0 ? (
          <p className="text-sm text-[var(--text-caption)]">暂无入库任务</p>
        ) : (
          <div className="space-y-2">
            {imports.slice(0, 20).map((t) => (
              <div key={t.id} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs">
                <span className="font-medium">{t.library_id}</span> · {t.status}
                {t.library_item_id && <span className="text-[var(--text-caption)]"> · {t.library_item_id.slice(0, 8)}…</span>}
                {t.error_message && <span className="text-red-400"> · {t.error_message}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <FiDatabase className="h-4 w-4" /> 已入库资源
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-[var(--text-caption)]">暂无入库资源</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--bg-inset)] text-left text-xs text-[var(--text-caption)]">
                <tr>
                  <th className="px-4 py-3">标题</th>
                  <th className="px-4 py-3">库</th>
                  <th className="px-4 py-3">分类</th>
                  <th className="px-4 py-3">质量</th>
                  <th className="px-4 py-3">状态</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3">{item.title}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.library_id}</td>
                    <td className="px-4 py-3">{item.category || "—"}</td>
                    <td className="px-4 py-3">{item.quality_score?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-3">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
