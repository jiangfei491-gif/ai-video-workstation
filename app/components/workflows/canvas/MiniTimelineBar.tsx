"use client";

import { FiChevronUp } from "react-icons/fi";
import type { EditSequence } from "@/app/lib/auto-edit/types";

type Props = {
  sequence: EditSequence | null;
  onOpenEdit: () => void;
};

export default function MiniTimelineBar({ sequence, onOpenEdit }: Props) {
  if (!sequence?.playOrder.length) {
    return (
      <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-[var(--border)] bg-[var(--bg-surface)]/95 px-4 py-2 backdrop-blur">
        <button
          type="button"
          onClick={onOpenEdit}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          打开剪辑视图，建立时间轴 →
        </button>
      </div>
    );
  }

  const total = Math.max(sequence.totalDurationSec, 1);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-[var(--border)] bg-[var(--bg-surface)]/95 px-4 py-2 backdrop-blur">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-caption)]">
          播放顺序 · {sequence.totalDurationSec.toFixed(0)}s
        </span>
        <button
          type="button"
          onClick={onOpenEdit}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--accent)] hover:underline"
        >
          展开剪辑 <FiChevronUp className="h-3 w-3" />
        </button>
      </div>
      <div className="flex h-8 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-inset)]">
        {sequence.playOrder.map((key, idx) => {
          const clip = sequence.clips[key];
          if (!clip) return null;
          const pct = (clip.durationSec / total) * 100;
          const missing = clip.sourceKind === "missing";
          return (
            <div
              key={key}
              title={`${idx + 1}. ${clip.label} · ${clip.durationSec}s`}
              className={`flex shrink-0 items-center justify-center border-r border-[var(--border)]/50 text-[9px] font-medium last:border-r-0 ${
                missing
                  ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                  : clip.sourceKind === "video"
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
              }`}
              style={{ width: `${pct}%`, minWidth: 24 }}
            >
              {idx + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
}
