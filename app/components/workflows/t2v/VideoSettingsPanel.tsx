"use client";

import AspectClarityControls from "@/app/components/workflows/shared/AspectClarityControls";
import { CAMERA_TEMPLATES } from "@/app/lib/consistency-engine/engines/camera-engine";
import { STYLE_PRESETS } from "@/app/lib/consistency-engine/engines/style-engine";
import type { PipelineMode } from "@/app/lib/pipeline-mode";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import { normalizeVeoDurationSec } from "@/app/lib/shot-control/types";
import { calcTotalDurationSec } from "@/app/lib/shot-control/types";
import { SHOT_COUNT_OPTIONS, SHOT_DURATION_OPTIONS } from "@/app/lib/shot-control/types";
import {
  clampShotCount,
  clampShotDurationSec,
  formatDurationMinutesLabel,
  buildShotPlan,
} from "@/app/lib/shot-control/plan-from-script";
import {
  clampImageBudget,
  IMAGE_BUDGET_MODE_LABELS,
  resolveImageBudget,
  type ImageBudgetMode,
} from "@/app/lib/shot-control/image-budget";
import { clampDurationMinutes } from "@/app/lib/materials/script-evolution/duration-config";

type Patch = (p: Partial<T2VWorkbenchState>) => void;

type Props = {
  state: T2VWorkbenchState;
  patch: Patch;
  disabled?: boolean;
  pipelineMode?: PipelineMode;
  /** 导入脚本或运行编导时 AI 推断视觉设定中 */
  visualInferring?: boolean;
};

const FPS = [24, 30, 60] as const;
const TARGET_DURATION_PRESETS = [1, 3, 5, 8, 10, 15] as const;
const IMAGE_BUDGET_MODES: ImageBudgetMode[] = ["economy", "standard", "premium", "custom"];

export default function VideoSettingsPanel({
  state,
  patch,
  disabled,
  pipelineMode = "t2v",
  visualInferring,
}: Props) {
  const isT2i = pipelineMode === "t2i";
  const imageBudgetMode = state.imageBudgetMode ?? "standard";
  const imageBudget = state.imageBudget ?? resolveImageBudget({
    targetDurationSec: Math.round((state.targetDurationMinutes ?? 1) * 60),
    mode: imageBudgetMode,
  });
  const total = calcTotalDurationSec(state.shotCount, state.shotDurationSec);
  const veoSec = normalizeVeoDurationSec(state.shotDurationSec);
  const targetSec = state.targetDurationMinutes
    ? Math.round(state.targetDurationMinutes * 60)
    : null;

  function patchT2iPlan(patchPartial: {
    targetDurationMinutes?: number;
    imageBudgetMode?: ImageBudgetMode;
    imageBudget?: number;
  }) {
    const minutes = clampDurationMinutes(
      patchPartial.targetDurationMinutes ?? state.targetDurationMinutes ?? 1
    );
    const mode = patchPartial.imageBudgetMode ?? imageBudgetMode;
    const plan = buildShotPlan({
      targetDurationMinutes: minutes,
      pipelineMode: "t2i",
      imageBudgetMode: mode,
      imageBudget:
        mode === "custom"
          ? clampImageBudget(patchPartial.imageBudget ?? imageBudget)
          : undefined,
    });
    patch({
      targetDurationMinutes: plan.targetDurationMinutes,
      imageBudget: plan.imageBudget,
      imageBudgetMode: plan.imageBudgetMode,
    });
  }

  function patchShotCount(raw: number) {
    patch({ shotCount: clampShotCount(raw, pipelineMode) });
  }

  function patchShotDuration(raw: number) {
    patch({ shotDurationSec: clampShotDurationSec(raw, pipelineMode) });
  }

  return (
    <div className="space-y-5">
      {isT2i ? (
        <>
          <div>
            <p className="workbench-label mb-2">视频时长</p>
            <div className="flex flex-wrap items-center gap-2">
              {TARGET_DURATION_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  onClick={() => patchT2iPlan({ targetDurationMinutes: m })}
                  className={`option-chip ${
                    state.targetDurationMinutes === m ? "option-chip-active" : ""
                  }`}
                >
                  {formatDurationMinutesLabel(m)}
                </button>
              ))}
              <span className="text-xs text-[var(--text-caption)]">或手动</span>
              <input
                type="number"
                min={0.5}
                max={60}
                step={0.5}
                disabled={disabled}
                value={state.targetDurationMinutes ?? 1}
                onChange={(e) =>
                  patchT2iPlan({
                    targetDurationMinutes: clampDurationMinutes(Number(e.target.value) || 1),
                  })
                }
                className="input-field w-24 rounded-lg px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-[var(--text-caption)]">分钟</span>
            </div>
            {targetSec != null && (
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                目标成片 {formatDurationMinutesLabel(state.targetDurationMinutes!)}（{targetSec}{" "}
                秒）· 叙事镜头数由脚本拆解决定，不由时长公式推导
              </p>
            )}
          </div>

          <div>
            <p className="workbench-label mb-2">图片预算</p>
            <div className="flex flex-wrap gap-2">
              {IMAGE_BUDGET_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={disabled}
                  title={IMAGE_BUDGET_MODE_LABELS[mode].hint}
                  onClick={() => patchT2iPlan({ imageBudgetMode: mode })}
                  className={`option-chip ${
                    imageBudgetMode === mode ? "option-chip-active" : ""
                  }`}
                >
                  {IMAGE_BUDGET_MODE_LABELS[mode].label}
                </button>
              ))}
            </div>
            {imageBudgetMode === "custom" && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={200}
                  disabled={disabled}
                  value={imageBudget}
                  onChange={(e) =>
                    patchT2iPlan({
                      imageBudgetMode: "custom",
                      imageBudget: clampImageBudget(Number(e.target.value) || 5),
                    })
                  }
                  className="input-field w-24 rounded-lg px-2 py-1.5 text-sm"
                />
                <span className="text-xs text-[var(--text-caption)]">张</span>
              </div>
            )}
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              当前规划 {imageBudget} 张评分生图
              {imageBudgetMode !== "custom" && (
                <span className="text-[var(--text-caption)]">
                  {" "}
                  · {IMAGE_BUDGET_MODE_LABELS[imageBudgetMode].hint}
                </span>
              )}
            </p>
          </div>
        </>
      ) : (
        <>
          <div>
            <p className="workbench-label mb-2">镜头数量</p>
            <div className="flex flex-wrap items-center gap-2">
              {SHOT_COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => patchShotCount(n)}
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
                onChange={(e) => patchShotCount(Number(e.target.value) || 1)}
                className="input-field w-24 rounded-lg px-2 py-1.5 text-sm"
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
                  onClick={() => patchShotDuration(n)}
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
                onChange={(e) => patchShotDuration(Number(e.target.value) || 1)}
                className="input-field w-24 rounded-lg px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-[var(--text-caption)]">秒</span>
            </div>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              总时长 {state.shotCount} × {state.shotDurationSec} = {total} 秒 · 单镜生成对齐到{" "}
              {veoSec} 秒（Veo 仅支持 4/6/8 秒）
            </p>
          </div>
        </>
      )}

      <AspectClarityControls
        aspectRatio={state.aspectRatio}
        customAspectRatio={state.customAspectRatio}
        clarity={state.clarity}
        customClarityWidth={state.customClarityWidth}
        customClarityHeight={state.customClarityHeight}
        disabled={disabled}
        patch={(p) => patch(p as Partial<T2VWorkbenchState>)}
      />

      {!isT2i && (
        <>
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
        </>
      )}

      <div className="rounded-xl bg-[var(--bg-inset)] p-4 space-y-3">
          {visualInferring && (
            <p className="text-xs text-[var(--accent)]">
              AI 正在根据脚本推断项目圣经、风格预设、世界观与镜头模板…
            </p>
          )}
          <div>
            <p className="workbench-label">项目圣经（全局锁定）</p>
            <p className="workbench-caption mt-0.5">
              所有镜头继承以下规则；生图时由系统注入，模型只负责当前镜头变化。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["videoType", "视频类型", "纪录片 / 悬疑 / 电影感"],
                ["colorTone", "色调", "冷色 / 暗调 / 低饱和"],
                ["cameraLanguage", "摄影语言", "写实 / 35mm / 手持感"],
                ["lightingRules", "光线规则", "夜景 / 阴天 / 室内荧光灯"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} className="block">
                <span className="text-xs text-[var(--text-caption)]">{label}</span>
                <input
                  type="text"
                  disabled={disabled}
                  value={state.projectBible?.[key] ?? ""}
                  onChange={(e) =>
                    patch({
                      projectBible: {
                        ...(state.projectBible ?? {}),
                        [key]: e.target.value,
                      },
                    })
                  }
                  placeholder={placeholder}
                  className="input-field mt-1 w-full rounded-lg px-2.5 py-1.5 text-sm"
                />
              </label>
            ))}
          </div>
          <label className="block">
            <span className="text-xs text-[var(--text-caption)]">禁止项</span>
            <input
              type="text"
              disabled={disabled}
              value={state.projectBible?.forbidden ?? ""}
              onChange={(e) =>
                patch({
                  projectBible: { ...(state.projectBible ?? {}), forbidden: e.target.value },
                })
              }
              placeholder="不要卡通、不要插画、不要换脸、不要换衣服"
              className="input-field mt-1 w-full rounded-lg px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--text-caption)]">风格 DNA（补充）</span>
            <input
              type="text"
              disabled={disabled}
              value={state.projectStyle}
              onChange={(e) => patch({ projectStyle: e.target.value })}
              placeholder="例如：cold documentary, desaturated, handheld realism"
              className="input-field mt-1 w-full rounded-lg px-2.5 py-1.5 text-sm"
            />
          </label>
        </div>

      <div className="rounded-xl bg-[var(--bg-inset)] p-4 space-y-3">
          <p className="workbench-label">风格 / 镜头 / 世界观（Consistency Engine）</p>
          {visualInferring && (
            <p className="text-xs text-[var(--accent)]">AI 推断中，完成后将自动勾选对应预设…</p>
          )}
          <div>
            <span className="text-xs text-[var(--text-caption)]">风格预设</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => patch({ stylePresetId: "custom" })}
                className={`option-chip ${state.stylePresetId === "custom" ? "option-chip-active" : ""}`}
              >
                自定义
              </button>
              {STYLE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => patch({ stylePresetId: p.id })}
                  className={`option-chip ${state.stylePresetId === p.id ? "option-chip-active" : ""}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-[var(--text-caption)]">镜头模板</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {CAMERA_TEMPLATES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => patch({ cameraTemplateId: c.id })}
                  className={`option-chip ${state.cameraTemplateId === c.id ? "option-chip-active" : ""}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["era", "时代", "2018"],
                ["country", "国家/地区", "中国"],
                ["city", "城市", "普通县城"],
                ["architecture", "建筑", "中式老旧居民楼"],
              ] as const
            ).map(([key, label, ph]) => (
              <label key={key} className="block">
                <span className="text-xs text-[var(--text-caption)]">{label}</span>
                <input
                  type="text"
                  disabled={disabled}
                  value={state.worldBible?.[key] ?? ""}
                  onChange={(e) =>
                    patch({
                      worldBible: { ...(state.worldBible ?? {}), [key]: e.target.value },
                    })
                  }
                  placeholder={ph}
                  className="input-field mt-1 w-full rounded-lg px-2.5 py-1.5 text-sm"
                />
              </label>
            ))}
          </div>

          <div className="rounded-lg bg-[var(--bg-surface)] p-3 space-y-3">
            <p className="workbench-label">四级生图策略 · 质量模式</p>
            <p className="text-[10px] text-[var(--text-caption)]">
              FLUX 草稿（BFL 官方 API）→ AI 十维评分 → 精修（标准走 FLUX dev / 高级·旗舰走 GPT Image）→ Final QC + 修复
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["fast", "极速", "全 FLUX，仅草稿+评分，最低成本"],
                  ["standard", "标准", "FLUX → 评分 → FLUX dev 精修 + 1 次 QC（不花 OpenAI 生图）"],
                  ["advanced", "高级", "FLUX → 评分 → GPT Image 精修（达标才跑）+ QC + 自动修复"],
                  ["flagship", "旗舰", "FLUX dev → 评分 → GPT Image 精修（必跑）+ QC + 自动修复"],
                ] as const
              ).map(([id, label, hint]) => (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  title={hint}
                  onClick={() =>
                    patch({
                      consistencySettings: {
                        ...(state.consistencySettings ?? {}),
                        qualityMode: id,
                      },
                    })
                  }
                  className={`option-chip ${
                    (state.consistencySettings?.qualityMode ?? "standard") === id
                      ? "option-chip-active"
                      : ""
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="text-xs text-[var(--text-caption)]">
                Tier2 评分阈值（低于此分不升级精修）
              </span>
              <input
                type="number"
                min={70}
                max={99}
                disabled={disabled}
                value={state.consistencySettings?.scoreThreshold ?? 90}
                onChange={(e) =>
                  patch({
                    consistencySettings: {
                      ...(state.consistencySettings ?? {}),
                      scoreThreshold: Math.max(
                        70,
                        Math.min(99, Number(e.target.value) || 90)
                      ),
                    },
                  })
                }
                className="input-field mt-1 w-24 rounded-lg px-2.5 py-1.5 text-sm"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.consistencySettings?.qcEnabled ?? true}
                onChange={(e) =>
                  patch({
                    consistencySettings: {
                      ...(state.consistencySettings ?? {}),
                      qcEnabled: e.target.checked,
                    },
                  })
                }
              />
              生成后 Visual QC
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.consistencySettings?.autoRepair ?? true}
                onChange={(e) =>
                  patch({
                    consistencySettings: {
                      ...(state.consistencySettings ?? {}),
                      autoRepair: e.target.checked,
                    },
                  })
                }
              />
              不合格自动修复
            </label>
          </div>
        </div>
    </div>
  );
}
