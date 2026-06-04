"use client";

import type { GenerationMode } from "@/app/lib/generation-mode";

type Props = {
  mode: GenerationMode;
  onChange: (mode: GenerationMode) => void;
  productionDisabled?: boolean;
};

export default function GenerationModeToggle({
  mode,
  onChange,
  productionDisabled,
}: Props) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange("test")}
        className={`rounded-lg px-3 py-1.5 text-sm ${
          mode === "test"
            ? "nav-item-active font-medium"
            : "text-[var(--text-muted)] hover:bg-[var(--bg-inset)]"
        }`}
      >
        测试模式（3s）
      </button>
      <button
        type="button"
        disabled={productionDisabled}
        onClick={() => onChange("production")}
        className={`rounded-lg px-3 py-1.5 text-sm ${
          mode === "production"
            ? "nav-item-active font-medium"
            : "text-[var(--text-muted)] hover:bg-[var(--bg-inset)]"
        } ${productionDisabled ? "cursor-not-allowed opacity-40" : ""}`}
        title={productionDisabled ? "请先锁定 Shot Lock" : undefined}
      >
        正式模式（8–12s）
      </button>
    </div>
  );
}
