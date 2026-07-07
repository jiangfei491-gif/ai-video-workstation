"use client";

import { FiCheck, FiChevronDown, FiAlertTriangle } from "react-icons/fi";

export type StepStatus = "idle" | "done" | "warn" | "active";

type Props = {
  step: number;
  title: string;
  subtitle?: string;
  status: StepStatus;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export default function EditStepAccordion({
  step,
  title,
  subtitle,
  status,
  open,
  onToggle,
  children,
}: Props) {
  return (
    <div className="edit-step overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-inset)]"
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            status === "done"
              ? "bg-[var(--success-soft)] text-[var(--success)]"
              : status === "warn"
                ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                : status === "active"
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "bg-[var(--bg-inset)] text-[var(--text-caption)]"
          }`}
        >
          {status === "done" ? <FiCheck className="h-3.5 w-3.5" /> : status === "warn" ? <FiAlertTriangle className="h-3.5 w-3.5" /> : step}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
          {subtitle && (
            <p className="truncate text-xs text-[var(--text-caption)]">{subtitle}</p>
          )}
        </div>
        <FiChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--text-caption)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-[var(--border)] px-3 py-3">{children}</div>}
    </div>
  );
}
