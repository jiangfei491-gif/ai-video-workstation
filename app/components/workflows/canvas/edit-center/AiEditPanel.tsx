"use client";

import Link from "next/link";
import { FiLoader, FiRefreshCw, FiPlay } from "react-icons/fi";
import type { EditPlanVariant } from "@/app/lib/auto-edit/edit-graph/types";
import type { EditRenderMode } from "@/app/lib/auto-edit/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import type { EditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";
import { EDIT_RENDER_MODE_OPTIONS, pacingProfileLabel, transitionTypeLabel } from "@/app/lib/auto-edit";
import AiDecisionPanel from "./AiDecisionPanel";
import EngineRoadmapPanel from "./EngineRoadmapPanel";
import EditRenderProgressPanel from "@/app/components/workflows/canvas/EditRenderProgressPanel";

type Props = {
  plans: EditPlanVariant[];
  activePlanId: string | null;
  renderMode: EditRenderMode;
  planLoading: boolean;
  bgmUrl: string | null;
  bgmVolume: number;
  engineSettings: EditEngineSettings;
  workbench: T2VWorkbenchState;
  projectName: string;
  editRendering: boolean;
  renderProgress: { pct: number; message: string };
  editError: string | null;
  finalEditVideoUrl: string | null;
  onRenderMode: (m: EditRenderMode) => void;
  onGeneratePlan: () => void;
  onApplyPlan: (planId: string) => void;
  onSyncAssets: () => void;
  onBgmUpload: (file: File) => void;
  onBgmVolume: (v: number) => void;
  onRender: () => void;
};

export default function AiEditPanel({
  plans,
  activePlanId,
  renderMode,
  planLoading,
  bgmUrl,
  bgmVolume,
  engineSettings,
  workbench,
  projectName,
  editRendering,
  renderProgress,
  editError,
  finalEditVideoUrl,
  onRenderMode,
  onGeneratePlan,
  onApplyPlan,
  onSyncAssets,
  onBgmUpload,
  onBgmVolume,
  onRender,
}: Props) {
  const activePlan = plans.find((p) => p.id === activePlanId) ?? plans[plans.length - 1];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3">
      <p className="text-xs font-semibold text-[var(--text-primary)]">AI 剪辑</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--text-caption)]">
        AI 生成剪辑方案 · 本机渲染引擎合成成片
      </p>

      <div className="mt-3 space-y-2">
        <span className="text-[10px] text-[var(--text-caption)]">成片模式</span>
        {EDIT_RENDER_MODE_OPTIONS.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => onRenderMode(mode.id)}
            className={`w-full rounded-lg border p-2 text-left ${
              renderMode === mode.id
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] bg-[var(--bg-inset)]"
            }`}
          >
            <p className="text-xs font-semibold">
              {mode.emoji} {mode.title}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-caption)]">{mode.description}</p>
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={onSyncAssets}
          className="btn-secondary flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <FiRefreshCw className="h-4 w-4" />
          同步素材
        </button>
        <button
          type="button"
          disabled={planLoading}
          onClick={onGeneratePlan}
          className="btn-secondary flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
        >
          {planLoading ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiRefreshCw className="h-4 w-4" />}
          生成 AI 方案
        </button>
        <Link
          href="/subtitle-center"
          className="btn-secondary flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          字幕中心
        </Link>
      </div>

      <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2.5">
        <AiDecisionPanel plan={activePlan} />
      </div>

      <EngineRoadmapPanel />

      <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-secondary)]">背景音乐</p>
        <label className="btn-secondary mt-2 flex w-full cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-xs">
          上传 BGM
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onBgmUpload(f);
              e.target.value = "";
            }}
          />
        </label>
        {bgmUrl && (
          <p className="mt-1 truncate text-[9px] text-[var(--success)]">已设置背景音乐</p>
        )}
        <label className="mt-2 block text-[10px] text-[var(--text-caption)]">
          音量 {Math.round(bgmVolume * 100)}%
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(bgmVolume * 100)}
            onChange={(e) => onBgmVolume(Number(e.target.value) / 100)}
            className="mt-1 w-full"
          />
        </label>
      </div>

      {plans.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold text-[var(--text-secondary)]">
            方案 ({plans.length})
          </p>
          <ul className="space-y-2">
            {[...plans].reverse().map((plan) => {
              const isActive = plan.id === activePlanId;
              return (
                <li
                  key={plan.id}
                  className={`rounded-lg border p-2.5 ${
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--bg-inset)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{plan.name}</p>
                      <p className="text-[10px] text-[var(--text-caption)]">
                        {plan.timeline.durationSec.toFixed(1)} 秒 · {plan.timeline.video.length} 镜 ·{" "}
                        {pacingProfileLabel(plan.pacingProfile)}
                      </p>
                    </div>
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => onApplyPlan(plan.id)}
                        className="shrink-0 rounded px-2 py-0.5 text-[10px] text-[var(--accent)] hover:bg-[var(--bg-surface)]"
                      >
                        应用
                      </button>
                    )}
                  </div>
                  {plan.rationale.summary.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[10px] text-[var(--text-secondary)]">
                      {plan.rationale.summary.slice(0, 3).map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  )}
                  {plan.timeline.transitions.some((t) => t.type !== "cut") && (
                    <p className="mt-1.5 text-[9px] text-[var(--text-caption)]">
                      转场：
                      {[...new Set(
                        plan.timeline.transitions
                          .filter((t) => t.type !== "cut")
                          .map((t) => transitionTypeLabel(t.type))
                      )].join("、") || "硬切"}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {activePlan && activePlan.rationale.summary.length > 0 && (
        <div className="mt-3 rounded-lg bg-[var(--bg-inset)] p-2.5 text-[10px] text-[var(--text-secondary)]">
          <p className="mb-1 font-semibold text-[var(--text-primary)]">当前方案说明</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {activePlan.rationale.summary.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {editRendering && (
          <EditRenderProgressPanel progress={renderProgress.pct} message={renderProgress.message} />
        )}
        <button
          type="button"
          disabled={editRendering}
          onClick={onRender}
          className="btn-primary flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
        >
          {editRendering ? (
            <FiLoader className="h-4 w-4 animate-spin" />
          ) : (
            <FiPlay className="h-4 w-4" />
          )}
          {editRendering ? `渲染中 ${Math.round(renderProgress.pct)}%` : "渲染成片"}
        </button>
        {editError && <p className="text-xs text-[var(--danger)]">{editError}</p>}
        {!editRendering && finalEditVideoUrl && !editError && (
          <p className="text-xs text-[var(--success)]">上次渲染已成功</p>
        )}
        {finalEditVideoUrl && (
          <a
            href={finalEditVideoUrl}
            download
            className="btn-secondary block w-full rounded-lg px-3 py-2 text-center text-sm"
          >
            下载成片
          </a>
        )}
      </div>
    </div>
  );
}
