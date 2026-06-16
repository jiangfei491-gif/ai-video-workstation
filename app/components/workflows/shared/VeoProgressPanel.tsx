"use client";

import type { VeoJobStatus } from "@/app/lib/workbench-persist/types";
import { FiLoader } from "react-icons/fi";

type Props = {
  status: VeoJobStatus;
  step: 1 | 2 | 3;
  error?: string | null;
  successMessage?: string | null;
};

const STEPS = [
  "步骤 1/3：提交任务",
  "步骤 2/3：等待视频生成",
  "步骤 3/3：加载视频",
] as const;

export default function VeoProgressPanel({ status, step, error, successMessage }: Props) {
  if (status === "idle") return null;

  if (status === "generating") {
    return (
      <div className="mt-4 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-inset)] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <FiLoader className="h-4 w-4 animate-spin text-[var(--accent)]" />
          正在生成视频预览…
        </div>
        <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
          {STEPS.map((label, i) => {
            const idx = i + 1;
            const active = idx === step;
            const done = idx < step;
            return (
              <li
                key={label}
                className={`flex items-center gap-2 ${
                  active ? "font-medium text-[var(--text-primary)]" : ""
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    done
                      ? "bg-emerald-500/20 text-emerald-600"
                      : active
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "bg-[var(--bg-surface)] text-[var(--text-muted)]"
                  }`}
                >
                  {done ? "✓" : idx}
                </span>
                {label}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-[var(--text-caption)]">
          生成中…预计 30~90 秒，请勿关闭页面
        </p>
      </div>
    );
  }

  if (status === "success" && successMessage) {
    return (
      <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
        ✓ {successMessage}
      </div>
    );
  }

  if (status === "failed" && error) {
    return (
      <div className="mt-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
        ✗ 视频生成失败
        <p className="mt-1 text-xs font-normal opacity-90">错误原因：{error}</p>
      </div>
    );
  }

  return null;
}
