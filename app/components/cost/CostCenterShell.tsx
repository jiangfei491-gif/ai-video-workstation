"use client";

import { useCallback, useEffect, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";

type Bucket = { key: string; cost: number; count?: number };
type Summary = {
  total: number;
  count: number;
  estimatedShare: number;
  byModule: Bucket[];
  byModel: Bucket[];
  byProvider: Bucket[];
  byDay: { key: string; cost: number }[];
  today: number;
  last30d: number;
};
type Entry = {
  id: string;
  at: string;
  module: string;
  operation: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  units?: number;
  unitKind?: string;
  costUsd: number;
  estimated: boolean;
};

function usd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

function Bar({ label, cost, max, count }: { label: string; cost: number; max: number; count?: number }) {
  const pct = max > 0 ? Math.max(2, (cost / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 truncate text-[var(--text-secondary)]" title={label}>{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded bg-[var(--bg-inset)]">
        <div className="h-full rounded bg-[var(--accent)]" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right font-medium text-[var(--text-primary)]">{usd(cost)}</span>
      {count != null && <span className="w-12 shrink-0 text-right text-[var(--text-caption)]">{count}次</span>}
    </div>
  );
}

export default function CostCenterShell() {
  const [sum, setSum] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch("/api/cost?limit=100").then((r) => r.json());
      setSum(d.summary);
      setEntries(d.entries ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maxModule = Math.max(1, ...(sum?.byModule.map((b) => b.cost) ?? [1]));
  const maxModel = Math.max(1, ...(sum?.byModel.map((b) => b.cost) ?? [1]));
  const maxProvider = Math.max(1, ...(sum?.byProvider.map((b) => b.cost) ?? [1]));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-caption)]">
            {sum ? `${sum.count} 笔记录 · 估算占比 ${(sum.estimatedShare * 100).toFixed(0)}%` : "加载中…"}
          </span>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)] disabled:opacity-60"
          >
            <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
          </button>
        </div>

        {sum && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "累计总花费", val: sum.total },
                { label: "近 30 天", val: sum.last30d },
                { label: "今日", val: sum.today },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                  <p className="text-xs text-[var(--text-caption)]">{c.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{usd(c.val)}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">按模块（哪个中心烧钱）</h3>
                {sum.byModule.length === 0 && <p className="text-xs text-[var(--text-caption)]">暂无</p>}
                {sum.byModule.map((b) => (
                  <Bar key={b.key} label={b.key} cost={b.cost} max={maxModule} count={b.count} />
                ))}
              </section>
              <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">按供应商</h3>
                {sum.byProvider.length === 0 && <p className="text-xs text-[var(--text-caption)]">暂无</p>}
                {sum.byProvider.map((b) => (
                  <Bar key={b.key} label={b.key} cost={b.cost} max={maxProvider} count={b.count} />
                ))}
              </section>
            </div>

            <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">按模型</h3>
              {sum.byModel.slice(0, 12).map((b) => (
                <Bar key={b.key} label={b.key} cost={b.cost} max={maxModel} count={b.count} />
              ))}
            </section>
          </>
        )}

        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <h3 className="mb-2 text-sm font-medium text-[var(--text-primary)]">最近明细</h3>
          {entries.length === 0 && (
            <p className="text-xs text-[var(--text-caption)]">
              还没有成本记录。产生付费调用（生视频/生图/打分/配音…）后会自动记账。
            </p>
          )}
          <ul className="space-y-1 text-xs">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 border-b border-[var(--border)] py-1.5">
                <span className="w-28 shrink-0 text-[var(--text-caption)]">{e.at.replace("T", " ").slice(5, 16)}</span>
                <span className="w-16 shrink-0 text-[var(--text-secondary)]">{e.module}</span>
                <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
                  {e.operation} · {e.model}
                  {e.units != null && <span className="text-[var(--text-caption)]"> ×{e.units}{e.unitKind ?? ""}</span>}
                </span>
                <span className="w-20 shrink-0 text-right font-medium text-[var(--text-primary)]">
                  {usd(e.costUsd)}
                </span>
                <span
                  className="w-8 shrink-0 text-right text-[10px]"
                  style={{ color: e.estimated ? "#f59e0b" : "#22c55e" }}
                  title={e.estimated ? "价格表估算" : "供应商真实用量"}
                >
                  {e.estimated ? "估" : "实"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
