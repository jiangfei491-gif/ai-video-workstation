"use client";

import { FiCheck, FiX, FiLoader, FiPlay, FiZap, FiClock } from "react-icons/fi";
import type { BatchShotState, DirectorState } from "@/app/lib/workbench-persist/types";

type Props = {
  director: DirectorState;
  batchRunning: boolean;
  batchResults: Record<number, BatchShotState>;
  /** 批量生成全部镜头 */
  onRunBatch: () => void;
  /** 单独重试某一镜头 */
  onRetryShot: (index: number) => void;
  /** 选中某镜头（同步到分镜面板） */
  onSelectShot: (index: number) => void;
};

const STATUS_META: Record<
  BatchShotState["status"],
  { icon: React.ReactNode; label: string; cls: string }
> = {
  pending: { icon: <FiClock className="h-3.5 w-3.5" />, label: "等待中", cls: "text-[var(--text-caption)]" },
  generating: { icon: <FiLoader className="h-3.5 w-3.5 animate-spin" />, label: "生成中", cls: "text-[var(--accent)]" },
  success: { icon: <FiCheck className="h-3.5 w-3.5" />, label: "完成", cls: "text-green-500" },
  failed: { icon: <FiX className="h-3.5 w-3.5" />, label: "失败", cls: "text-[var(--danger)]" },
};

export default function BatchGeneratePanel({
  director,
  batchRunning,
  batchResults,
  onRunBatch,
  onRetryShot,
  onSelectShot,
}: Props) {
  const total = director.prompts.length;
  const entries = Object.values(batchResults);
  const done = entries.filter((s) => s.status === "success").length;
  const failed = entries.filter((s) => s.status === "failed").length;
  const active = entries.filter((s) => s.status === "generating").length;
  const hasResults = entries.length > 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="workbench-label">批量生成 · 全部镜头并行</p>
          <p className="mt-0.5 text-xs text-[var(--text-caption)]">
            {batchRunning
              ? `生成中 · ${active} 个并行 · ${done}/${total} 完成${failed ? ` · ${failed} 失败` : ""}`
              : hasResults
                ? `${done}/${total} 完成${failed ? ` · ${failed} 失败` : ""}`
                : `一次跑完 ${total} 个镜头，无需逐个等待`}
          </p>
        </div>
        <button
          type="button"
          disabled={batchRunning}
          onClick={onRunBatch}
          className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {batchRunning ? (
            <FiLoader className="h-4 w-4 animate-spin" />
          ) : (
            <FiZap className="h-4 w-4" />
          )}
          {batchRunning ? "生成中…" : hasResults ? "重新生成全部" : `一键生成全部 ${total} 镜头`}
        </button>
      </div>

      {/* 总进度条 */}
      {(batchRunning || hasResults) && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* 镜头网格 */}
      {hasResults && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {director.prompts.map((_, i) => {
            const shot = batchResults[i] ?? { status: "pending" as const, videoUrl: null };
            const meta = STATUS_META[shot.status];
            return (
              <div
                key={i}
                className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]/40"
              >
                <div className="relative aspect-[9/16] bg-black/30">
                  {shot.status === "success" && shot.videoUrl ? (
                    <video
                      src={shot.videoUrl}
                      className="h-full w-full object-cover"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                    />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center ${meta.cls}`}>
                      {shot.status === "generating" ? (
                        <FiLoader className="h-6 w-6 animate-spin" />
                      ) : shot.status === "failed" ? (
                        <FiX className="h-6 w-6" />
                      ) : (
                        <FiClock className="h-6 w-6 opacity-50" />
                      )}
                    </div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    镜头 {i + 1}
                  </span>
                  {shot.status === "success" && shot.videoUrl && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white">
                      <FiPlay className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${meta.cls}`}>
                    {meta.icon}
                    {meta.label}
                  </span>
                  {shot.status === "success" ? (
                    <button
                      type="button"
                      onClick={() => onSelectShot(i)}
                      className="text-[11px] text-[var(--accent)] hover:underline"
                    >
                      编辑
                    </button>
                  ) : shot.status === "failed" && !batchRunning ? (
                    <button
                      type="button"
                      onClick={() => onRetryShot(i)}
                      className="text-[11px] text-[var(--accent)] hover:underline"
                    >
                      重试
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
