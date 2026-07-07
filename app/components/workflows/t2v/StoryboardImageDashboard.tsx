"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiChevronDown,
  FiChevronUp,
  FiMaximize2,
  FiRefreshCw,
  FiStar,
  FiTrash2,
  FiZap,
} from "react-icons/fi";
import LoadingButton from "@/app/components/workflows/shared/LoadingButton";
import ProjectCostBreakdownPanel from "@/app/components/workflows/t2v/ProjectCostBreakdownPanel";
import type { BatchImageState } from "@/app/components/workflows/t2v/BatchImageGeneratePanel";
import {
  SHOT_IMAGE_COST_USD,
  SHOT_IMAGE_SEC_EST,
  formatDuration,
  formatUsd,
} from "@/app/lib/image/shot-image-estimates";
import type { DirectorState } from "@/app/lib/workbench-persist/types";
import type { ProjectCostLedger } from "@/app/lib/cost-ledger/types";
import type { ShotTimelineEntry } from "@/app/lib/consistency-engine/types/world-style-camera";

type ImageFrame = {
  url: string;
  assetId: string;
  model?: string;
  source?: string;
};

export type ShotImageStatus = "generated" | "generating" | "failed" | "pending";

type Props = {
  director: DirectorState;
  activeShotIdx: number;
  onSelectShot: (index: number) => void;
  onUpdatePrompt: (index: number, providerPrompt: string) => void;
  shotImages: Record<number, string>;
  shotImageMeta: Record<number, { model: string; source: string; aspectRatio?: string }>;
  shotFavorites: Record<number, boolean>;
  defaultAspectRatio: string;
  imageLoadingShot: number | null;
  imageBatchStatus: Record<number, BatchImageState>;
  batchRunning: boolean;
  onGenerateImage: (index: number) => void;
  onPreviewImage: (url: string) => void;
  onToggleFavorite: (index: number) => void;
  onRunBatch: () => void;
  onRunBatchSelected: (indices: number[], regenerate?: boolean) => void;
  onDeleteShots: (indices: number[]) => void;
  onBatchFavorite: (indices: number[]) => void;
  shotTimeline?: Record<number, ShotTimelineEntry>;
  projectCostLedger?: ProjectCostLedger | null;
};

import { aspectRatioCss as aspectRatioCssUtil } from "@/app/lib/generation-params";

function resolveShotStatus(
  index: number,
  shotImages: Record<number, string>,
  imageLoadingShot: number | null,
  batchStatus?: BatchImageState
): ShotImageStatus {
  if (imageLoadingShot === index || batchStatus?.status === "generating") return "generating";
  if (batchStatus?.status === "failed") return "failed";
  if (shotImages[index]) return "generated";
  return "pending";
}

const STATUS_META: Record<
  ShotImageStatus,
  { label: string; text: string; dot: string }
> = {
  generated: {
    label: "已生成",
    text: "text-[var(--success)]",
    dot: "bg-[var(--success)]",
  },
  generating: {
    label: "生成中",
    text: "text-[var(--status-queued)]",
    dot: "bg-[var(--status-queued)]",
  },
  failed: {
    label: "失败",
    text: "text-[var(--danger)]",
    dot: "bg-[var(--danger)]",
  },
  pending: {
    label: "未生成",
    text: "text-[var(--text-caption)]",
    dot: "bg-[var(--text-caption)]/40",
  },
};

function StatCell({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-[var(--text-caption)]">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${accent ?? "text-[var(--text-primary)]"}`}>
        {value}
      </p>
    </div>
  );
}

function ShotCard({
  index,
  director,
  active,
  selected,
  shotImages,
  shotImageMeta,
  shotFavorites,
  defaultAspectRatio,
  loading,
  batchStatus,
  onSelect,
  onToggleSelect,
  onUpdatePrompt,
  onGenerate,
  onPreview,
  onToggleFavorite,
  timelineEntry,
}: {
  index: number;
  director: DirectorState;
  active: boolean;
  selected: boolean;
  shotImages: Record<number, string>;
  shotImageMeta: Record<number, { model: string; source: string; aspectRatio?: string }>;
  shotFavorites: Record<number, boolean>;
  defaultAspectRatio: string;
  loading: boolean;
  batchStatus?: BatchImageState;
  onSelect: () => void;
  onToggleSelect: () => void;
  onUpdatePrompt: (prompt: string) => void;
  onGenerate: () => void;
  onPreview: () => void;
  onToggleFavorite: () => void;
  timelineEntry?: ShotTimelineEntry;
}) {
  const [promptOpen, setPromptOpen] = useState(false);
  const prompt = director.prompts[index]?.providerPrompt ?? "";
  const imageUrl = shotImages[index];
  const aspectRatio = shotImageMeta[index]?.aspectRatio ?? defaultAspectRatio;
  const status = resolveShotStatus(index, shotImages, loading ? index : null, batchStatus);
  const statusMeta = STATUS_META[status];
  const favorited = !!shotFavorites[index];
  const isGenerating = status === "generating";
  const qc = timelineEntry?.qc;
  const scoreComposite = timelineEntry?.score?.scores.composite;

  return (
    <article
      className={`dashboard-shot-card group flex flex-col overflow-hidden rounded-lg bg-[var(--bg-surface)] ${
        active ? "ring-1 ring-[var(--accent)]/60" : ""
      } ${selected ? "ring-1 ring-[var(--accent)]" : ""}`}
    >
      {/* 图片区 — 占卡片 85%+，零 padding，统一比例 */}
      <div
        className="dashboard-shot-media relative w-full cursor-pointer overflow-hidden bg-[var(--bg-inset)]"
        style={{ aspectRatio: aspectRatioCssUtil(aspectRatio) }}
        onClick={onSelect}
      >
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`镜头 ${index + 1}`}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
              className="dashboard-shot-zoom-btn absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/55 text-white backdrop-blur-sm transition-all hover:bg-black/75"
              title="查看大图"
            >
              <FiMaximize2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[var(--text-caption)]">
            {isGenerating ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
                <span className="text-[11px]">生成中…</span>
              </>
            ) : status === "failed" ? (
              <span className="px-3 text-center text-[11px] text-[var(--danger)]">
                {batchStatus?.error ?? "生成失败"}
              </span>
            ) : (
              <span className="text-[11px] opacity-50">待生成</span>
            )}
          </div>
        )}

        {/* 顶栏浮层 — 不占布局高度 */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-1 bg-gradient-to-b from-black/50 to-transparent px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-3.5 w-3.5 shrink-0 rounded border-white/40 accent-[var(--accent)]"
              aria-label={`选择镜头 ${index + 1}`}
            />
            <span className="text-[11px] font-semibold tabular-nums text-white drop-shadow">
              #{index + 1}
            </span>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm ${
              isGenerating
                ? "bg-black/40 text-[var(--status-queued)]"
                : status === "generated"
                  ? "bg-black/40 text-[var(--success)]"
                  : status === "failed"
                    ? "bg-black/40 text-[var(--danger)]"
                    : "bg-black/30 text-white/70"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot} ${isGenerating ? "animate-pulse" : ""}`} />
            {statusMeta.label}
            {scoreComposite != null && !qc && (
              <span className="tabular-nums">{scoreComposite}</span>
            )}
            {qc && <span className="tabular-nums">QC {qc.scores.overall}</span>}
          </span>
        </div>
      </div>

      {/* 底部操作区 — 紧凑 60~80px */}
      <div className={`dashboard-shot-footer shrink-0 ${promptOpen ? "dashboard-shot-footer-expanded" : ""}`}>
        <button
          type="button"
          onClick={() => setPromptOpen((v) => !v)}
          className="flex w-full min-w-0 items-center gap-1 text-left"
        >
          {promptOpen ? (
            <FiChevronUp className="h-3 w-3 shrink-0 text-[var(--text-caption)]" />
          ) : (
            <FiChevronDown className="h-3 w-3 shrink-0 text-[var(--text-caption)]" />
          )}
          <span className="shrink-0 text-[10px] text-[var(--text-caption)]">Prompt</span>
          {!promptOpen && (
            <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--text-secondary)]" title={prompt}>
              {prompt || "—"}
            </span>
          )}
        </button>

        {promptOpen && (
          <textarea
            className="input-field mt-1 min-h-[44px] w-full resize-none rounded-md px-2 py-1 text-[10px] leading-relaxed"
            value={prompt}
            onChange={(e) => onUpdatePrompt(e.target.value)}
            onFocus={onSelect}
            rows={2}
          />
        )}

        <div className="dashboard-shot-actions mt-1.5 flex items-center justify-between gap-2">
          {!imageUrl ? (
            <button
              type="button"
              disabled={isGenerating}
              onClick={onGenerate}
              className="dashboard-shot-action-compact flex-1"
            >
              <FiZap className="h-3 w-3" />
              <span>生成</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onToggleFavorite}
                className={`dashboard-shot-action-compact ${favorited ? "text-[var(--accent)]" : ""}`}
                title={favorited ? "取消收藏" : "收藏"}
              >
                <FiStar className={`h-3 w-3 ${favorited ? "fill-current" : ""}`} />
                <span>{favorited ? "已收藏" : "收藏"}</span>
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={onGenerate}
                  className="dashboard-shot-action-compact"
                  title="重新生成"
                >
                  <FiRefreshCw className="h-3 w-3" />
                  <span>重新生成</span>
                </button>
                <button
                  type="button"
                  onClick={onPreview}
                  className="dashboard-shot-action-compact dashboard-shot-action-accent"
                  title="查看大图"
                >
                  <FiMaximize2 className="h-3 w-3" />
                  <span>放大</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export default function StoryboardImageDashboard({
  director,
  activeShotIdx,
  onSelectShot,
  onUpdatePrompt,
  shotImages,
  shotImageMeta,
  shotFavorites,
  defaultAspectRatio,
  imageLoadingShot,
  imageBatchStatus,
  batchRunning,
  onGenerateImage,
  onPreviewImage,
  onToggleFavorite,
  onRunBatch,
  onRunBatchSelected,
  onDeleteShots,
  onBatchFavorite,
  shotTimeline = {},
  projectCostLedger,
}: Props) {
  const total = director.prompts.length;
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const stats = useMemo(() => {
    let generated = 0;
    let generating = 0;
    let failed = 0;
    let pending = 0;

    for (let i = 0; i < total; i++) {
      const s = resolveShotStatus(i, shotImages, imageLoadingShot, imageBatchStatus[i]);
      if (s === "generated") generated++;
      else if (s === "generating") generating++;
      else if (s === "failed") failed++;
      else pending++;
    }

    const estCost = total * SHOT_IMAGE_COST_USD;
    const spentCost = generated * SHOT_IMAGE_COST_USD;
    const estTime = total * SHOT_IMAGE_SEC_EST;
    const spentTime = generated * SHOT_IMAGE_SEC_EST;
    let qcPassed = 0;
    let qcFailed = 0;
    let repairTotal = 0;
    for (let i = 0; i < total; i++) {
      const entry = shotTimeline[i];
      if (entry?.qc) {
        if (entry.qc.passed) qcPassed++;
        else qcFailed++;
      }
      repairTotal += entry?.repairAttempts ?? 0;
    }

    return { generated, generating, failed, pending, estCost, spentCost, estTime, spentTime, qcPassed, qcFailed, repairTotal };
  }, [total, shotImages, imageLoadingShot, imageBatchStatus, shotTimeline]);

  const selectedArr = useMemo(() => [...selected].sort((a, b) => a - b), [selected]);
  const hasSelection = selected.size > 0;

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < total) next.add(i);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [total]);

  function toggleSelect(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(Array.from({ length: total }, (_, i) => i)));
  }

  function invertSelection() {
    setSelected((prev) => {
      const next = new Set<number>();
      for (let i = 0; i < total; i++) {
        if (!prev.has(i)) next.add(i);
      }
      return next;
    });
  }

  function requireSelection(action: (indices: number[]) => void) {
    if (!hasSelection) return;
    action(selectedArr);
  }

  return (
    <div className="space-y-4">
      <ProjectCostBreakdownPanel ledger={projectCostLedger} />
      {/* 统计栏 */}
      <div className="dashboard-stats-bar overflow-hidden rounded-xl bg-[var(--bg-surface)]">
        <div className="flex flex-wrap items-stretch divide-x divide-[var(--border)]/30">
          <StatCell label="总镜头" value={total} />
          <StatCell label="已生成" value={stats.generated} accent="text-[var(--success)]" />
          <StatCell label="生成中" value={stats.generating} accent="text-[var(--status-queued)]" />
          <StatCell label="未生成" value={stats.pending} accent="text-[var(--text-caption)]" />
          {stats.failed > 0 && (
            <StatCell label="失败" value={stats.failed} accent="text-[var(--danger)]" />
          )}
          {stats.qcPassed + stats.qcFailed > 0 && (
            <StatCell
              label="QC 通过"
              value={`${stats.qcPassed}/${stats.qcPassed + stats.qcFailed}`}
              accent="text-[var(--accent)]"
            />
          )}
          {stats.repairTotal > 0 && (
            <StatCell label="修复次数" value={stats.repairTotal} accent="text-[var(--status-queued)]" />
          )}
          <StatCell label="预计成本" value={formatUsd(stats.estCost)} />
          <StatCell label="已花费" value={formatUsd(stats.spentCost)} />
          <StatCell label="预计耗时" value={formatDuration(stats.estTime)} />
          <StatCell label="总耗时" value={formatDuration(stats.spentTime)} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)]/30 px-4 py-2.5">
          <LoadingButton
            loading={batchRunning}
            loadingText="生成中…"
            disabled={batchRunning}
            onClick={onRunBatch}
            className="!px-3 !py-1.5 !text-xs"
          >
            生成全部
          </LoadingButton>
          <button
            type="button"
            disabled={batchRunning || stats.generated === 0}
            onClick={() => onRunBatchSelected(Array.from({ length: total }, (_, i) => i), true)}
            className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            重新生成全部
          </button>
        </div>
      </div>

      {/* 批量工具栏 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--bg-surface)] px-4 py-2.5">
        <button type="button" onClick={selectAll} className="dashboard-batch-btn">
          全选
        </button>
        <button type="button" onClick={invertSelection} className="dashboard-batch-btn">
          反选
        </button>
        {hasSelection && (
          <span className="text-xs text-[var(--text-caption)]">已选 {selected.size} 镜</span>
        )}
        <span className="mx-1 h-4 w-px bg-[var(--border)]/40" />
        <button
          type="button"
          disabled={!hasSelection || batchRunning}
          onClick={() => requireSelection((idx) => onRunBatchSelected(idx, false))}
          className="dashboard-batch-btn disabled:opacity-40"
        >
          批量生成
        </button>
        <button
          type="button"
          disabled={!hasSelection || batchRunning}
          onClick={() => requireSelection((idx) => onRunBatchSelected(idx, true))}
          className="dashboard-batch-btn disabled:opacity-40"
        >
          批量重新生成
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => requireSelection(onDeleteShots)}
          className="dashboard-batch-btn text-[var(--danger)] disabled:opacity-40"
        >
          <FiTrash2 className="mr-1 inline h-3 w-3" />
          批量删除
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => requireSelection(onBatchFavorite)}
          className="dashboard-batch-btn disabled:opacity-40"
        >
          <FiStar className="mr-1 inline h-3 w-3" />
          批量收藏
        </button>
      </div>

      {/* 卡片网格 — 大图优先，自适应列宽 */}
      <div className="dashboard-shot-grid">
        {director.prompts.map((p, i) => (
          <ShotCard
            key={`${p.sceneNumber}-${i}`}
            index={i}
            director={director}
            active={i === activeShotIdx}
            selected={selected.has(i)}
            shotImages={shotImages}
            shotImageMeta={shotImageMeta}
            shotFavorites={shotFavorites}
            defaultAspectRatio={defaultAspectRatio}
            loading={imageLoadingShot === i}
            batchStatus={imageBatchStatus[i]}
            timelineEntry={shotTimeline[i]}
            onSelect={() => onSelectShot(i)}
            onToggleSelect={() => toggleSelect(i)}
            onUpdatePrompt={(text) => onUpdatePrompt(i, text)}
            onGenerate={() => onGenerateImage(i)}
            onPreview={() => {
              const url = shotImages[i];
              if (url) onPreviewImage(url);
            }}
            onToggleFavorite={() => onToggleFavorite(i)}
          />
        ))}
      </div>
    </div>
  );
}
