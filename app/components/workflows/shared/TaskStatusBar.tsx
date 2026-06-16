"use client";

type Step = {
  id: string;
  label: string;
  status: "done" | "active" | "pending" | "failed";
};

type Props = {
  steps: Step[];
};

const ICON: Record<Step["status"], string> = {
  done: "✓",
  active: "⏳",
  pending: "□",
  failed: "✗",
};

export default function TaskStatusBar({ steps }: Props) {
  return (
    <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-caption)]">
        当前状态
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {steps.map((step, i) => (
          <span key={step.id} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-[var(--text-muted)]">→</span>}
            <span
              className={
                step.status === "active"
                  ? "font-semibold text-[var(--accent)]"
                  : step.status === "done"
                    ? "font-medium text-emerald-600 dark:text-emerald-400"
                    : step.status === "failed"
                      ? "font-medium text-[var(--danger)]"
                      : "text-[var(--text-secondary)]"
              }
            >
              {ICON[step.status]} {step.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
