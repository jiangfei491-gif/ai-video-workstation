"use client";

import WorkbenchSection from "@/app/components/workflows/shared/WorkbenchSection";
import type { ExportMeta, ExportType } from "@/app/lib/export/types";
import {
  exportStatusLabel,
  exportTypeLabel,
  formatExportDateShort,
  formatExportDateTime,
  isExportSuccess,
} from "@/app/lib/export/types";

type WorkbenchKind = "t2v" | "t2i";

type Props = {
  workbench: WorkbenchKind;
  exportMeta: ExportMeta;
  canExportProject: boolean;
  canExportMedia: boolean;
  onExportProject: () => void | Promise<void>;
  onExportMedia: () => void | Promise<void>;
  onDeleteRecord: () => void;
};

function buttonClass(
  type: ExportType,
  meta: ExportMeta,
  disabled: boolean
): string {
  const base =
    "inline-flex min-w-[7.5rem] items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all";
  const isActive =
    meta.exportStatus === "exporting" && meta.activeExportType === type;
  const isSuccess =
    isExportSuccess(meta) && meta.lastExportType === type;
  const isFailed =
    meta.exportStatus === "failed" && meta.lastExportType === type;

  if (isActive) {
    return `${base} border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm`;
  }
  if (isSuccess) {
    return `${base} border-[var(--success)] bg-[rgba(4,120,87,0.08)] text-[var(--success)]`;
  }
  if (isFailed) {
    return `${base} border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]`;
  }
  if (disabled) {
    return `${base} cursor-not-allowed border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-muted)] opacity-60`;
  }
  return `${base} border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]`;
}

function ExportActionButton({
  label,
  type,
  meta,
  disabled,
  onClick,
}: {
  label: string;
  type: ExportType;
  meta: ExportMeta;
  disabled: boolean;
  onClick: () => void;
}) {
  const isActive =
    meta.exportStatus === "exporting" && meta.activeExportType === type;
  const isSuccess =
    isExportSuccess(meta) && meta.lastExportType === type;

  let text = label;
  if (isActive) text = `导出中 ${meta.exportProgress}%`;
  else if (isSuccess) text = "✓ 已导出";

  return (
    <button
      type="button"
      disabled={disabled || isActive}
      onClick={onClick}
      className={buttonClass(type, meta, disabled)}
    >
      {text}
    </button>
  );
}

export default function ExportPanel({
  workbench,
  exportMeta,
  canExportProject,
  canExportMedia,
  onExportProject,
  onExportMedia,
  onDeleteRecord,
}: Props) {
  const mediaLabel = workbench === "t2v" ? "导出视频" : "导出图片包";
  const mediaType: ExportType = workbench === "t2v" ? "video" : "images";
  const exporting = exportMeta.exportStatus === "exporting";
  const hasRecord =
    isExportSuccess(exportMeta) ||
    exportMeta.exportCount > 0 ||
    exportMeta.lastExportAt != null;

  return (
    <WorkbenchSection title="导出">
      <div className="mb-4 flex flex-wrap gap-2">
        <ExportActionButton
          label="导出项目"
          type="project"
          meta={exportMeta}
          disabled={!canExportProject || exporting}
          onClick={() => void onExportProject()}
        />
        <ExportActionButton
          label={mediaLabel}
          type={mediaType}
          meta={exportMeta}
          disabled={!canExportMedia || exporting}
          onClick={() => void onExportMedia()}
        />
        {hasRecord && (
          <button
            type="button"
            disabled={exporting}
            onClick={onDeleteRecord}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-60"
          >
            删除记录
          </button>
        )}
      </div>

      {exportMeta.exportStatus === "exporting" && (
        <div className="mb-4 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-[var(--accent)]">
              导出中 {exportMeta.exportProgress}%
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {exportMeta.exportStageMessage}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-inset)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200 ease-out"
              style={{ width: `${exportMeta.exportProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[var(--border)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[var(--text-primary)]">导出记录</p>
          <span
            className={`text-sm font-medium ${
              isExportSuccess(exportMeta)
                ? "text-[var(--success)]"
                : exportMeta.exportStatus === "failed"
                  ? "text-[var(--danger)]"
                  : exportMeta.exportStatus === "exporting"
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-secondary)]"
            }`}
          >
            状态：{exportStatusLabel(
              exportMeta.exportStatus === "exporting"
                ? "exporting"
                : isExportSuccess(exportMeta)
                  ? "success"
                  : exportMeta.exportStatus
            )}
          </span>
        </div>

        {exportMeta.exportStatus === "failed" && exportMeta.exportError && (
          <p className="mt-2 text-xs text-[var(--danger)]">{exportMeta.exportError}</p>
        )}

        {isExportSuccess(exportMeta) && (
          <dl className="mt-3 grid gap-2 text-xs">
            <div className="flex justify-between gap-4 text-[var(--text-secondary)]">
              <dt>导出时间</dt>
              <dd className="font-medium text-[var(--text-primary)]">
                {exportMeta.lastExportAt
                  ? formatExportDateTime(exportMeta.lastExportAt)
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 text-[var(--text-secondary)]">
              <dt>导出类型</dt>
              <dd className="font-medium text-[var(--text-primary)]">
                {exportTypeLabel(exportMeta.lastExportType)}
              </dd>
            </div>
            {exportMeta.exportFileName && (
              <div className="flex justify-between gap-4 text-[var(--text-secondary)]">
                <dt>导出文件</dt>
                <dd className="max-w-[60%] truncate font-medium text-[var(--text-primary)]">
                  {exportMeta.exportFileName}
                </dd>
              </div>
            )}
          </dl>
        )}

        {(exportMeta.exportCount > 0 || exportMeta.lastExportAt) && (
          <dl className="mt-3 grid gap-2 border-t border-[var(--border)] pt-3 text-xs">
            <div className="flex justify-between gap-4 text-[var(--text-secondary)]">
              <dt>最后导出</dt>
              <dd className="font-medium text-[var(--text-primary)]">
                {exportMeta.lastExportAt
                  ? formatExportDateShort(exportMeta.lastExportAt)
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 text-[var(--text-secondary)]">
              <dt>最后导出类型</dt>
              <dd className="font-medium text-[var(--text-primary)]">
                {exportTypeLabel(exportMeta.lastExportType)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 text-[var(--text-secondary)]">
              <dt>导出次数</dt>
              <dd className="font-medium text-[var(--text-primary)]">
                {exportMeta.exportCount}次
              </dd>
            </div>
          </dl>
        )}
      </div>
    </WorkbenchSection>
  );
}
