"use client";

import type { PipelineMode } from "@/app/lib/pipeline-mode";
import { PIPELINE_MODE_LABELS, PIPELINE_MODES } from "@/app/lib/pipeline-mode";

type Props = {
  mode: PipelineMode;
  onChange: (mode: PipelineMode) => void;
};

export default function PipelineModeToggle({ mode, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PIPELINE_MODES.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            mode === value ? "nav-item-active" : "bg-[var(--bg-inset)] text-[var(--text-secondary)]"
          }`}
        >
          {PIPELINE_MODE_LABELS[value]}
        </button>
      ))}
    </div>
  );
}
