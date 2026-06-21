"use client";

import SeedModeControls from "@/app/components/workflows/shared/SeedModeControls";
import { CLARITY_OPTIONS } from "@/app/lib/generation-params";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import { normalizeVeoDurationSec } from "@/app/lib/shot-control/types";
import { calcTotalDurationSec } from "@/app/lib/shot-control/types";
import { SHOT_COUNT_OPTIONS, SHOT_DURATION_OPTIONS } from "@/app/lib/shot-control/types";

type Patch = (p: Partial<T2VWorkbenchState>) => void;

type Props = {
  state: T2VWorkbenchState;
  patch: Patch;
  disabled?: boolean;
};

const FPS = [24, 30, 60] as const;

export default function VideoSettingsPanel({ state, patch, disabled }: Props) {
  const total = calcTotalDurationSec(state.shotCount, state.shotDurationSec);
  const veoSec = normalizeVeoDurationSec(state.shotDurationSec);

  return (
    <div className="space-y-5">
      <div>
        <p className="workbench-label mb-2">镜头数量</p>
        <div className="flex flex-wrap items-center gap-2">
          {SHOT_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => patch({ shotCount: n })}
              className={`option-chip ${state.shotCount === n ? "option-chip-active" : ""}`}
            >
              {n} 镜头
            </button>
          ))}
          <span className="text-xs text-[var(--text-caption)]">或手动</span>
          <input
            type="number"
            min={1}
            max={30}
            disabled={disabled}
            value={state.shotCount}
            onChange={(e) =>
              patch({ shotCount: Math.max(1, Math.min(30, Math.floor(Number(e.target.value) || 1))) })
            }
            className="input-field w-20 rounded-lg px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <p className="workbench-label mb-2">单镜头时长</p>
        <div className="flex flex-wrap items-center gap-2">
          {SHOT_DURATION_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => patch({ shotDurationSec: n })}
              className={`option-chip ${state.shotDurationSec === n ? "option-chip-active" : ""}`}
            >
              {n} 秒
            </button>
          ))}
          <span className="text-xs text-[var(--text-caption)]">或手动</span>
          <input
            type="number"
            min={1}
            max={60}
            disabled={disabled}
            value={state.shotDurationSec}
            onChange={(e) =>
              patch({ shotDurationSec: Math.max(1, Math.min(60, Math.floor(Number(e.target.value) || 1))) })
            }
            className="input-field w-20 rounded-lg px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-[var(--text-caption)]">秒</span>
        </div>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          总时长 {state.shotCount} × {state.shotDurationSec} = {total} 秒 · 单镜生成对齐到 {veoSec} 秒（Veo 仅支持 4/6/8 秒）
        </p>
      </div>

      <div>
        <p className="workbench-label mb-2">画面比例</p>
        <div className="flex flex-wrap gap-2">
          {(["9:16", "16:9"] as const).map((r) => (
            <button
              key={r}
              type="button"
              disabled={disabled}
              onClick={() => patch({ aspectRatio: r })}
              className={`option-chip ${state.aspectRatio === r ? "option-chip-active" : ""}`}
            >
              {r === "9:16" ? "竖屏 9:16" : "横屏 16:9"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="workbench-label mb-2">清晰度</p>
        <div className="flex flex-wrap gap-2">
          {CLARITY_OPTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => patch({ clarity: c.id })}
              className={`option-chip ${state.clarity === c.id ? "option-chip-active" : ""}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="workbench-label mb-2">帧率</p>
        <div className="flex flex-wrap gap-2">
          {FPS.map((f) => (
            <button
              key={f}
              type="button"
              disabled={disabled}
              onClick={() => patch({ fps: f })}
              className={`option-chip ${state.fps === f ? "option-chip-active" : ""}`}
            >
              {f} 帧/秒
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="workbench-label mb-2">工作模式</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => patch({ workspaceMode: "preview", mode: "test" })}
            className={`option-chip ${state.workspaceMode === "preview" ? "option-chip-active" : ""}`}
          >
            测试模式
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => patch({ workspaceMode: "production" })}
            className={`option-chip ${state.workspaceMode === "production" ? "option-chip-active" : ""}`}
          >
            正式模式
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <input
            type="checkbox"
            checked={state.characterConsistency}
            onChange={(e) => patch({ characterConsistency: e.target.checked })}
          />
          人物一致性
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <input
            type="checkbox"
            checked={state.sceneConsistency}
            onChange={(e) => patch({ sceneConsistency: e.target.checked })}
          />
          场景一致性
        </label>
      </div>

      <SeedModeControls
        seedMode={state.seedMode}
        seed={state.seed}
        disabled={disabled}
        onChange={(p) => patch(p)}
      />
    </div>
  );
}
