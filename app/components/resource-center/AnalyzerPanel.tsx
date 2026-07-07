"use client";

import { useCallback, useEffect, useState } from "react";
import { FiCpu, FiRefreshCw, FiRotateCw } from "react-icons/fi";

type AnalysisTask = {
  id: string;
  filename: string;
  status: string;
  library_id: string | null;
  analysis_result: {
    title?: string;
    category?: string;
    tags?: string[];
    qualityScore?: number;
    canImport?: boolean;
    model?: string;
  };
  error_message: string | null;
  created_at: string;
};

export default function AnalyzerPanel() {
  const [tasks, setTasks] = useState<AnalysisTask[]>([]);
  const [deepseekOk, setDeepseekOk] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/resource-center/analyzer/tasks");
      const data = (await res.json()) as { tasks: AnalysisTask[]; deepseekAvailable: boolean };
      setTasks(data.tasks ?? []);
      setDeepseekOk(Boolean(data.deepseekAvailable));
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh({ silent: true }), 6000);
    return () => clearInterval(t);
  }, [refresh]);

  async function retry(id: string) {
    await fetch(`/api/resource-center/analyzer/tasks/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry" }),
    });
    await refresh({ silent: true });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">AI Analyzer</h2>
          <p className="text-sm text-[var(--text-caption)]">
            DeepSeek 统一分析 · 分类 · 标签 · 质量评分 · 去重检测
          </p>
          <p className="mt-1 text-xs text-[var(--text-caption)]">
            DeepSeek {deepseekOk ? "已接入" : "未配置（规则回退）"} · 需 DEEPSEEK_API_KEY
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} className="btn-secondary rounded-lg px-3 py-2 text-sm">
          <FiRefreshCw className="inline h-4 w-4" /> 刷新
        </button>
      </div>

      {loading && tasks.length === 0 ? (
        <p className="text-sm text-[var(--text-caption)]">加载中…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-[var(--text-caption)]">
          暂无分析任务。下载完成后会自动进入 AI 分析队列。
        </p>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <div key={t.id} className="rounded-xl border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{t.filename}</p>
                  <p className="text-xs text-[var(--text-caption)]">
                    <FiCpu className="inline h-3 w-3" /> {t.status}
                    {t.library_id ? ` · → ${t.library_id}` : ""}
                    {t.analysis_result.model ? ` · ${t.analysis_result.model}` : ""}
                  </p>
                </div>
                {t.status === "analysis_failed" && (
                  <button type="button" onClick={() => void retry(t.id)} className="rounded border px-2 py-1 text-xs">
                    <FiRotateCw className="inline" /> 重试
                  </button>
                )}
              </div>
              {t.analysis_result.title && (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">{t.analysis_result.title}</p>
              )}
              {t.analysis_result.tags?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.analysis_result.tags.map((tag) => (
                    <span key={tag} className="rounded-full border px-2 py-0.5 text-[10px] text-[var(--text-caption)]">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {t.error_message && <p className="mt-1 text-xs text-red-400">{t.error_message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
