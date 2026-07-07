"use client";

import type { AutoEditStepResult } from "@/app/lib/auto-edit/run-auto-edit-pipeline";
import { FiCheck, FiLoader, FiMinus } from "react-icons/fi";

type Props = {
  steps: AutoEditStepResult[];
  running: boolean;
  currentMessage?: string;
};

const STATUS_ICON = {
  done: FiCheck,
  skipped: FiMinus,
  failed: FiMinus,
};

const STATUS_CLASS = {
  done: "text-[var(--success)]",
  skipped: "text-[var(--text-caption)]",
  failed: "text-[var(--danger)]",
};

export default function AiAutoEditStatusPanel({ steps, running, currentMessage }: Props) {
  return (
    <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">AI 剪辑状态</p>
        {running && (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)]">
            <FiLoader className="h-3.5 w-3.5 animate-spin" />
            处理中…
          </span>
        )}
      </div>
      {currentMessage && (
        <p className="mt-1 text-xs text-[var(--text-caption)]">{currentMessage}</p>
      )}
      <ul className="mt-3 space-y-2">
        {steps.length === 0 && !running && (
          <li className="text-xs text-[var(--text-caption)]">点击「一键 AI 剪辑」开始全自动流程</li>
        )}
        {steps.map((step) => {
          const Icon = STATUS_ICON[step.status];
          return (
            <li key={step.id} className="flex items-start gap-2 text-xs">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${STATUS_CLASS[step.status]}`} />
              <div className="min-w-0">
                <span className="font-medium text-[var(--text-primary)]">{step.label}</span>
                <span className="mx-1 text-[var(--text-caption)]">·</span>
                <span className="text-[var(--text-secondary)]">{step.message}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
