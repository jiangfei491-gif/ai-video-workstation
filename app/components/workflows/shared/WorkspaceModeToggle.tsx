"use client";

import type { WorkspaceMode } from "@/app/lib/workspace-mode";
import { WORKSPACE_MODE_LABELS } from "@/app/lib/workspace-mode";

type Props = {
  mode: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
};

export default function WorkspaceModeToggle({ mode, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(["preview", "production"] as WorkspaceMode[]).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`rounded-lg px-3 py-1.5 text-xs ${
            mode === value ? "nav-item-active" : "bg-[var(--bg-inset)]"
          }`}
        >
          {WORKSPACE_MODE_LABELS[value]}
        </button>
      ))}
    </div>
  );
}
