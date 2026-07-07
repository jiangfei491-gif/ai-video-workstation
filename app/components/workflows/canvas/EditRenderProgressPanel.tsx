"use client";

import { FiLoader } from "react-icons/fi";

type Props = {
  progress: number;
  message: string;
};

export default function EditRenderProgressPanel({ progress, message }: Props) {
  const pct = Math.min(100, Math.max(0, progress));

  return (
    <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-inset)] p-4">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-2 font-medium text-[var(--text-primary)]">
          <FiLoader className="h-4 w-4 shrink-0 animate-spin text-[var(--accent)]" />
          渲染成片中…
        </span>
        <span className="font-mono text-xs font-semibold text-[var(--accent)]">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--text-caption)]">
        {message || "渲染引擎准备中…"}
      </p>
    </div>
  );
}
