"use client";

import { FiRefreshCw, FiZoomIn, FiZoomOut } from "react-icons/fi";

type Props = {
  playheadSec: number;
  durationSec: number;
  onSyncAssets?: () => void;
  zoom?: number;
  onZoom?: (z: number) => void;
};

function formatTimecode(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor((sec % 1) * 30);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

export default function TimelineToolbar({
  playheadSec,
  durationSec,
  onSyncAssets,
  zoom = 1,
  onZoom,
}: Props) {
  return (
    <div className="nle-timeline-toolbar flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-inset)] px-3 py-1.5">
      {onSyncAssets && (
        <button
          type="button"
          onClick={onSyncAssets}
          className="edit-icon-btn"
          title="同步画布素材"
        >
          <FiRefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
      <span className="font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
        {formatTimecode(playheadSec)}
        <span className="mx-1 text-[var(--text-caption)]">/</span>
        {formatTimecode(durationSec)}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          className="edit-icon-btn"
          title="缩小时间轴"
          onClick={() => onZoom?.(Math.max(0.6, zoom - 0.15))}
        >
          <FiZoomOut className="h-3.5 w-3.5" />
        </button>
        <input
          type="range"
          min={60}
          max={160}
          value={Math.round(zoom * 100)}
          onChange={(e) => onZoom?.(Number(e.target.value) / 100)}
          className="edit-range w-20"
          title="时间轴缩放"
        />
        <button
          type="button"
          className="edit-icon-btn"
          title="放大时间轴"
          onClick={() => onZoom?.(Math.min(1.6, zoom + 0.15))}
        >
          <FiZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
