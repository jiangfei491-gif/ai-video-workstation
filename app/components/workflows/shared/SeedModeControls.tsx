"use client";

import {
  DEFAULT_FIXED_SEED,
  type SeedMode,
} from "@/app/lib/generation-params";

type Props = {
  seedMode: SeedMode;
  seed: number | null;
  onChange: (patch: { seedMode: SeedMode; seed: number | null }) => void;
  disabled?: boolean;
};

export default function SeedModeControls({
  seedMode,
  seed,
  onChange,
  disabled,
}: Props) {
  return (
    <div>
      <p className="workbench-label mb-2">随机种子</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ seedMode: "random", seed: null })}
          className={`option-chip ${seedMode === "random" ? "option-chip-active" : ""}`}
        >
          随机
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange({
              seedMode: "fixed",
              seed: seed ?? DEFAULT_FIXED_SEED,
            })
          }
          className={`option-chip ${seedMode === "fixed" ? "option-chip-active" : ""}`}
        >
          固定
        </button>
      </div>
      {seedMode === "fixed" && (
        <div className="mt-3">
          <label className="workbench-label mb-2 block">种子值</label>
          <input
            type="number"
            disabled={disabled}
            className="input-field w-full max-w-xs rounded-lg px-3 py-2 text-sm"
            value={seed ?? DEFAULT_FIXED_SEED}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({
                seedMode: "fixed",
                seed: Number.isFinite(n) ? n : DEFAULT_FIXED_SEED,
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
