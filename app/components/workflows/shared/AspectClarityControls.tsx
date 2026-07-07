"use client";

import {
  ASPECT_RATIO_OPTIONS,
  CLARITY_OPTIONS,
  type AspectClarityFields,
  type AspectRatioPreset,
  type ClarityId,
} from "@/app/lib/generation-params";

type Patch = (p: Partial<AspectClarityFields & Record<string, unknown>>) => void;

type Props = {
  aspectRatio: AspectRatioPreset | string;
  customAspectRatio?: string;
  clarity: ClarityId | string;
  customClarityWidth?: number;
  customClarityHeight?: number;
  patch: Patch;
  disabled?: boolean;
  aspectLabel?: string;
  clarityLabel?: string;
};

export default function AspectClarityControls({
  aspectRatio,
  customAspectRatio,
  clarity,
  customClarityWidth,
  customClarityHeight,
  patch,
  disabled,
  aspectLabel = "画面比例",
  clarityLabel = "清晰度",
}: Props) {
  const isCustomAspect = aspectRatio === "custom";
  const isCustomClarity = clarity === "custom";

  return (
    <>
      <div>
        <p className="workbench-label mb-2">{aspectLabel}</p>
        <div className="flex flex-wrap gap-2">
          {ASPECT_RATIO_OPTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={disabled}
              onClick={() => patch({ aspectRatio: a.id })}
              className={`option-chip ${aspectRatio === a.id ? "option-chip-active" : ""}`}
            >
              {a.label}
            </button>
          ))}
        </div>
        {isCustomAspect && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--text-caption)]">宽:高</span>
            <input
              type="text"
              disabled={disabled}
              value={customAspectRatio ?? ""}
              onChange={(e) => patch({ customAspectRatio: e.target.value.trim() })}
              placeholder="例如 5:4 或 1280:720"
              className="input-field w-36 rounded-lg px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-[var(--text-caption)]">格式 数字:数字</span>
          </div>
        )}
      </div>

      <div>
        <p className="workbench-label mb-2">{clarityLabel}</p>
        <div className="flex flex-wrap gap-2">
          {CLARITY_OPTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => patch({ clarity: c.id })}
              className={`option-chip ${clarity === c.id ? "option-chip-active" : ""}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {isCustomClarity && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--text-caption)]">宽 × 高</span>
            <input
              type="number"
              min={256}
              max={8192}
              step={8}
              disabled={disabled}
              value={customClarityWidth ?? 1024}
              onChange={(e) =>
                patch({
                  customClarityWidth: Math.max(
                    256,
                    Math.min(8192, Math.floor(Number(e.target.value) || 1024))
                  ),
                })
              }
              className="input-field w-24 rounded-lg px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-[var(--text-caption)]">×</span>
            <input
              type="number"
              min={256}
              max={8192}
              step={8}
              disabled={disabled}
              value={customClarityHeight ?? 1024}
              onChange={(e) =>
                patch({
                  customClarityHeight: Math.max(
                    256,
                    Math.min(8192, Math.floor(Number(e.target.value) || 1024))
                  ),
                })
              }
              className="input-field w-24 rounded-lg px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-[var(--text-caption)]">像素，8 的倍数</span>
          </div>
        )}
      </div>
    </>
  );
}
