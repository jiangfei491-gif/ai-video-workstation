"use client";

import { FiCheck, FiX, FiLoader, FiZap, FiClock } from "react-icons/fi";
import type { DirectorState } from "@/app/lib/workbench-persist/types";

export type BatchImageState = {
  status: "pending" | "generating" | "success" | "failed";
  error?: string;
};

type Props = {
  director: DirectorState;
  batchRunning: boolean;
  batchStatus: Record<number, BatchImageState>;
  shotImages: Record<number, string>;
  shotImageMeta?: Record<number, { model: string; source: string }>;
  onRunBatch: () => void;
  onRetryShot: (index: number) => void;
  onSelectShot: (index: number) => void;
  onPreviewImage?: (url: string) => void;
};

const STATUS_META: Record<
  BatchImageState["status"],
  { icon: React.ReactNode; label: string; cls: string }
> = {
  pending: { icon: <FiClock className="h-3.5 w-3.5" />, label: "等待中", cls: "text-[var(--text-caption)]" },
  generating: { icon: <FiLoader className="h-3.5 w-3.5 animate-spin" />, label: "生成中", cls: "text-[var(--accent)]" },
  success: { icon: <FiCheck className="h-3.5 w-3.5" />, label: "完成", cls: "text-green-500" },
  failed: { icon: <FiX className="h-3.5 w-3.5" />, label: "失败", cls: "text-[var(--danger)]" },
};

export default function BatchImageGeneratePanel({
  director,
  batchRunning,
  batchStatus,
  shotImages,
  shotImageMeta = {},
  onRunBatch,
  onRetryShot,
  onSelectShot,
  onPreviewImage,
}: Props) {
  const total = director.prompts.length;
  const done = Object.keys(shotImages).length;
  const failed = Object.values(batchStatus).filter((s) => s.status === "failed").length;
  const active = Object.values(batchStatus).filter((s) => s.status === "generating").length;
  const hasResults = done > 0 || Object.keys(batchStatus).length > 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const firstError = Object.values(batchStatus).find((s) => s.status === "failed")?.error;

  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="workbench-label">批量文生图 · 全部镜头</p>
          <p className="mt-0.5 text-xs text-[var(--text-caption)]">
            四级策略：FLUX → AI 评分 → GPT Image 精修 ·{" "}
            {batchRunning
              ? `生成中 · ${active} 个并行 · ${done}/${total} 完成${failed ? ` · ${failed} 失败` : ""}`
              : hasResults
                ? `${done}/${total} 已完成${failed ? ` · ${failed} 失败` : ""}`
                : `一次为 ${total} 个镜头各生成一张分镜图片`}
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
          {batchRunning ? "生成中…" : hasResults ? "重新生成全部" : `一键生成全部 ${total} 张`}
        </button>
      </div>

      {(batchRunning || hasResults) && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {firstError && (
        <p className="mt-2 text-xs font-medium text-[var(--danger)]">{firstError}</p>
      )}

      {hasResults && (
        <ul className="mt-3 space-y-2">
          {director.prompts.map((p, i) => {
            const status = shotImages[i]
              ? ({ status: "success" } as BatchImageState)
              : batchStatus[i] ?? ({ status: "pending" } as BatchImageState);
            const meta = STATUS_META[status.status];
            const promptPreview = p.providerPrompt.slice(0, 120);
            return (
              <li
                key={p.sceneNumber}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5"
              >
                <div className="flex gap-3">
                  {shotImages[i] ? (
                    <button
                      type="button"
                      onClick={() => onPreviewImage?.(shotImages[i])}
                      className="shrink-0 overflow-hidden rounded-lg border border-[var(--border)]"
                      title="点击查看大图"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shotImages[i]}
                        alt={`镜头 ${i + 1}`}
                        className="h-24 w-[4.5rem] object-cover"
                      />
                    </button>
                  ) : (
                    <div className="flex h-24 w-[4.5rem] shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-xs text-[var(--text-caption)]">
                      {i + 1}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectShot(i)}
                        className="text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]"
                      >
                        镜头 {i + 1}
                      </button>
                      {shotImageMeta[i] && (
                        <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--accent)]">
                          {shotImageMeta[i].model}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 text-xs ${meta.cls}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                      {status.status === "failed" && (
                        <button
                          type="button"
                          onClick={() => onRetryShot(i)}
                          className="text-xs font-medium text-[var(--accent)] hover:underline"
                        >
                          重试
                        </button>
                      )}
                    </div>
                    <p className="line-clamp-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                      {promptPreview}
                      {p.providerPrompt.length > 120 ? "…" : ""}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
