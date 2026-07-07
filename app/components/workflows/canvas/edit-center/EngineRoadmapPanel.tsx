"use client";

import { RENDER_ENGINE_ROADMAP, ROADMAP_STATUS_LABEL } from "@/app/lib/auto-edit/engines/roadmap";

const STATUS_CLASS = {
  production: "bg-[var(--success-soft)] text-[var(--success)]",
  usable: "bg-[var(--accent-soft)] text-[var(--accent)]",
  wired: "bg-[var(--bg-surface)] text-[var(--text-caption)]",
} as const;

export default function EngineRoadmapPanel() {
  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
      <p className="text-[10px] font-semibold text-[var(--text-primary)]">引擎路线图</p>
      <p className="mt-0.5 text-[9px] text-[var(--text-caption)]">
        AI Agent 引擎 · OpenCut 负责 NLE · 导出走 FFmpeg（待接 OpenCut SDK）
      </p>
      <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
        {RENDER_ENGINE_ROADMAP.map((item) => (
          <li key={item.id} className="text-[9px] text-[var(--text-caption)]">
            <span className="font-medium text-[var(--text-secondary)]">{item.title}</span>
            <span className={`ml-1 rounded px-1 py-0.5 ${STATUS_CLASS[item.status]}`}>
              {ROADMAP_STATUS_LABEL[item.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
