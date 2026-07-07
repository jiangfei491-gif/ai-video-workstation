"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FiDownload, FiRefreshCw } from "react-icons/fi";
import { getT2VState } from "@/app/lib/workbench-persist/t2v-store";
import type { EditPlanVariant, MediaPoolItem } from "@/app/lib/auto-edit/edit-graph/types";
import type { EditRenderMode } from "@/app/lib/auto-edit/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import type { EditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";
import {
  EDIT_RENDER_MODE_OPTIONS,
  pacingProfileLabel,
} from "@/app/lib/auto-edit";
import LoadingButton from "@/app/components/workflows/shared/LoadingButton";
import EditStepAccordion, { type StepStatus } from "./EditStepAccordion";
import EditEngineSettingsPanel from "./EditEngineSettingsPanel";
import MediaPoolPanel from "./MediaPoolPanel";
import EditRenderProgressPanel from "@/app/components/workflows/canvas/EditRenderProgressPanel";
import AiDecisionPanel from "./AiDecisionPanel";
import StoryGraphPanel from "./StoryGraphPanel";
import PlanComparePanel from "./PlanComparePanel";
import EngineRoadmapPanel from "./EngineRoadmapPanel";
import PlatformPipelinePanel from "./PlatformPipelinePanel";
import { loadGlossary } from "@/app/lib/auto-edit/engines/localization";

type Props = {
  state: T2VWorkbenchState;
  plans: EditPlanVariant[];
  activePlanId: string | null;
  mediaPool: MediaPoolItem[];
  renderMode: EditRenderMode;
  planLoading: boolean;
  narrationLoading: boolean;
  bgmRecommendLoading: boolean;
  transitionApplyLoading: boolean;
  bgmUrl: string | null;
  bgmVolume: number;
  engineSettings: EditEngineSettings;
  projectName: string;
  missingCount: number;
  editRendering: boolean;
  renderProgress: { pct: number; message: string };
  editError: string | null;
  finalEditVideoUrl: string | null;
  activeShotIndex: number | null;
  onRenderMode: (m: EditRenderMode) => void;
  onGeneratePlan: () => void;
  onApplyPlan: (planId: string) => void;
  onSyncAssets: () => void;
  onGenerateSpokenNarration: () => void;
  onRecommendBgm: () => void;
  onApplyDefaultTransitions: () => void;
  onBgmUpload: (file: File) => void;
  onBgmVolume: (v: number) => void;
  onSettingsChange: (patch: Partial<EditEngineSettings>) => void;
  onSelectMedia: (item: MediaPoolItem) => void;
  beatApplyLoading?: boolean;
  onApplyBeatSync?: () => void;
  onFocusShot?: (shotIndex: number) => void;
};

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EditWorkflowPanel({
  state,
  plans,
  activePlanId,
  mediaPool,
  renderMode,
  planLoading,
  narrationLoading,
  bgmRecommendLoading,
  transitionApplyLoading,
  bgmUrl,
  bgmVolume,
  engineSettings,
  projectName,
  missingCount,
  editRendering,
  renderProgress,
  editError,
  finalEditVideoUrl,
  activeShotIndex,
  onRenderMode,
  onGeneratePlan,
  onApplyPlan,
  onSyncAssets,
  onGenerateSpokenNarration,
  onRecommendBgm,
  onApplyDefaultTransitions,
  onBgmUpload,
  onBgmVolume,
  onSettingsChange,
  onSelectMedia,
  beatApplyLoading = false,
  onApplyBeatSync,
  onFocusShot,
}: Props) {
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({
    1: true,
    2: false,
    3: true,
    4: true,
    5: false,
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [showEngine, setShowEngine] = useState(false);

  const activePlan = plans.find((p) => p.id === activePlanId) ?? plans[plans.length - 1];
  const readyCount = mediaPool.filter((i) => i.status === "ready").length;
  const voiceStats = useMemo(() => {
    const voiceItems = mediaPool.filter((i) => i.kind === "voice");
    return {
      ready: voiceItems.filter((i) => i.status === "ready").length,
      pending: voiceItems.filter((i) => i.status === "pending").length,
    };
  }, [mediaPool]);
  const subtitleCount = useMemo(
    () => mediaPool.filter((i) => i.kind === "subtitle-text" && i.shotIndex !== undefined).length,
    [mediaPool]
  );

  const step1Status: StepStatus =
    missingCount > 0 ? "warn" : readyCount > 0 ? "done" : "idle";
  const step2Status: StepStatus = plans.length > 0 ? "done" : "idle";
  const step3Status: StepStatus =
    voiceStats.ready > 0 ? "done" : bgmUrl ? "done" : voiceStats.pending > 0 ? "active" : "idle";
  const step4Status: StepStatus = finalEditVideoUrl ? "done" : editRendering ? "active" : "idle";

  const toggle = (n: number) =>
    setOpenSteps((s) => ({ ...s, [n]: !s[n] }));

  const exportBundle = async () => {
    setExportLoading(true);
    try {
      const res = await fetch("/api/auto-edit/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workbench: state,
          settings: engineSettings,
          glossary: loadGlossary(),
        }),
      });
      const data = (await res.json()) as {
        artifacts?: { filename: string; content?: string }[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "导出失败");
      for (const art of data.artifacts ?? []) {
        if (art.content) downloadText(art.filename, art.content);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setExportLoading(false);
    }
  };

  const modeChips = useMemo(
    () =>
      EDIT_RENDER_MODE_OPTIONS.map((mode) => (
        <button
          key={mode.id}
          type="button"
          onClick={() => onRenderMode(mode.id)}
          className={`option-chip text-xs ${renderMode === mode.id ? "option-chip-active" : ""}`}
        >
          {mode.title}
        </button>
      )),
    [renderMode, onRenderMode]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[var(--border)] px-3 py-2.5">
        <p className="workbench-heading">AI 导演工作流</p>
        <p className="text-xs text-[var(--text-caption)]">
          AI 导演编排工程 · 中间为播放器与时间轴
        </p>
        <div className="mt-2">
          <PlatformPipelinePanel compact />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain p-3">
        {editError && (
          <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
            {editError}
          </p>
        )}
        <EditStepAccordion
          step={1}
          title="素材准备（Agent）"
          subtitle={`就绪 ${readyCount}${missingCount > 0 ? ` · 缺 ${missingCount}` : ""}`}
          status={step1Status}
          open={openSteps[1] ?? false}
          onToggle={() => toggle(1)}
        >
          <LoadingButton variant="secondary" onClick={onSyncAssets} className="w-full">
            <FiRefreshCw className="h-4 w-4" />
            同步画布素材
          </LoadingButton>
          <div className="mt-3 max-h-48 overflow-hidden rounded-lg border border-[var(--border)]">
            <MediaPoolPanel
              compact
              items={mediaPool}
              activeShotIndex={activeShotIndex}
              onSelectItem={onSelectMedia}
            />
          </div>
        </EditStepAccordion>

        <EditStepAccordion
          step={2}
          title="AI 自动剪辑 → 写入工程"
          subtitle={plans.length > 0 ? `${plans.length} 个方案 · 已写入时间轴` : "生成后写入时间线"}
          status={step2Status}
          open={openSteps[2] ?? false}
          onToggle={() => toggle(2)}
        >
          <p className="mb-2 text-xs text-[var(--text-caption)]">成片模式</p>
          <div className="flex flex-wrap gap-1.5">{modeChips}</div>
          <LoadingButton
            variant="secondary"
            loading={planLoading}
            loadingText="生成中…"
            onClick={onGeneratePlan}
            className="mt-3 w-full"
          >
            生成 AI 方案
          </LoadingButton>
          {plans.length > 0 && (
            <ul className="mt-3 space-y-2">
              {[...plans].reverse().slice(0, 4).map((plan) => {
                const isActive = plan.id === activePlanId;
                return (
                  <li
                    key={plan.id}
                    className={`rounded-lg border px-2.5 py-2 ${
                      isActive
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] bg-[var(--bg-inset)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{plan.name}</p>
                        <p className="text-xs text-[var(--text-caption)]">
                          {plan.timeline.durationSec.toFixed(0)} 秒 · {pacingProfileLabel(plan.pacingProfile)}
                        </p>
                      </div>
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => onApplyPlan(plan.id)}
                          className="shrink-0 text-xs font-medium text-[var(--accent)]"
                        >
                          应用
                        </button>
                      )}
                    </div>
                    {isActive && plan.rationale.summary[0] && (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                        {plan.rationale.summary[0]}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {plans.length > 0 && (
            <LoadingButton
              variant="secondary"
              loading={transitionApplyLoading}
              loadingText="应用中…"
              onClick={onApplyDefaultTransitions}
              className="mt-2 w-full"
            >
              应用默认转场到全部镜头
            </LoadingButton>
          )}
          {activePlan && activePlan.rationale.summary.length > 0 && (
            <div className="mt-3 rounded-lg bg-[var(--bg-inset)] p-2.5">
              <p className="text-xs font-medium text-[var(--text-primary)]">方案摘要</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-[var(--text-secondary)]">
                {activePlan.rationale.summary.slice(0, 3).map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </EditStepAccordion>

        <EditStepAccordion
          step={3}
          title="字幕 · BGM"
          subtitle={
            voiceStats.pending + voiceStats.ready > 0
              ? `配音 ${voiceStats.ready}/${voiceStats.ready + voiceStats.pending}（请在配音中心生成）· 字幕 ${subtitleCount} 条`
              : bgmUrl
                ? "BGM 已设置"
                : "请先同步素材"
          }
          status={step3Status}
          open={openSteps[3] ?? false}
          onToggle={() => toggle(3)}
        >
          <p className="mb-2 text-xs text-[var(--text-caption)]">
            口播稿在此生成；配音请前往「配音中心」，字幕请前往「字幕中心」
          </p>
          <LoadingButton
            variant="secondary"
            loading={narrationLoading}
            loadingText="生成口播稿…"
            onClick={onGenerateSpokenNarration}
            className="w-full"
          >
            AI 生成口播稿
          </LoadingButton>
          <Link
            href="/voice-center"
            className="btn-primary mt-2 flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs font-medium"
          >
            前往配音中心
          </Link>
          <Link
            href="/subtitle-center"
            className="btn-secondary mt-2 flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs font-medium"
          >
            前往字幕中心
          </Link>
          <LoadingButton
            variant="secondary"
            loading={bgmRecommendLoading}
            loadingText="推荐中…"
            onClick={onRecommendBgm}
            className="mt-2 w-full"
          >
            AI 推荐 BGM（本地素材库）
          </LoadingButton>
          <label className="btn-secondary mt-2 flex w-full cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-xs">
            上传背景音乐
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
            <p className="mt-1 text-xs text-[var(--success)]">背景音乐已就绪</p>
          )}
          <label className="mt-3 block text-xs text-[var(--text-caption)]">
            BGM 音量 {Math.round(bgmVolume * 100)}%
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(bgmVolume * 100)}
              onChange={(e) => onBgmVolume(Number(e.target.value) / 100)}
              className="edit-range mt-1.5 w-full"
            />
          </label>
        </EditStepAccordion>

        <EditStepAccordion
          step={4}
          title="渲染与导出"
          subtitle={finalEditVideoUrl ? "成片已就绪" : "渲染完成后可下载"}
          status={step4Status}
          open={openSteps[4] ?? false}
          onToggle={() => toggle(4)}
        >
          {editRendering && (
            <EditRenderProgressPanel
              progress={renderProgress.pct}
              message={renderProgress.message}
            />
          )}
          {editError && (
            <p className="mb-2 text-xs text-[var(--danger)]">{editError}</p>
          )}
          {!editRendering && finalEditVideoUrl && (
            <p className="mb-2 text-xs text-[var(--success)]">上次渲染成功</p>
          )}
          <div className="flex flex-col gap-2">
            <Link
              href="/subtitle-center"
              className="btn-secondary flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm"
            >
              <FiDownload className="h-4 w-4" />
              字幕中心导出
            </Link>
            <LoadingButton
              variant="secondary"
              loading={exportLoading}
              onClick={() => void exportBundle()}
              className="w-full"
            >
              <FiDownload className="h-4 w-4" />
              导出工程包
            </LoadingButton>
            {finalEditVideoUrl && (
              <a
                href={finalEditVideoUrl}
                download
                className="btn-primary block rounded-lg px-3 py-2.5 text-center text-sm font-medium"
              >
                下载成片
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowEngine((v) => !v)}
            className="mt-3 w-full text-left text-xs font-medium text-[var(--accent)]"
          >
            {showEngine ? "收起" : "展开"} 引擎高级设置
          </button>
          {showEngine && (
            <div className="mt-2">
              <EditEngineSettingsPanel settings={engineSettings} onChange={onSettingsChange} />
            </div>
          )}
        </EditStepAccordion>

        <EditStepAccordion
          step={5}
          title="导演与引擎"
          subtitle="Story Graph · AI 决策 · 路线图"
          status={plans.length > 0 ? "done" : "idle"}
          open={openSteps[5] ?? false}
          onToggle={() => toggle(5)}
        >
          <AiDecisionPanel plan={activePlan} />
          <div className="mt-3">
            <PlanComparePanel plans={plans} activePlanId={activePlanId} />
          </div>
          <div className="mt-3">
            <StoryGraphPanel
              state={state}
              engineSettings={engineSettings}
              beatApplyLoading={beatApplyLoading}
              onBpmChange={(bpm) => onSettingsChange({ storyGraph: { bpm } })}
              onApplyBeatSync={() => onApplyBeatSync?.()}
              onFocusShot={onFocusShot}
            />
          </div>
          <EngineRoadmapPanel />
          <div className="mt-3">
            <PlatformPipelinePanel />
          </div>
        </EditStepAccordion>
      </div>
    </div>
  );
}
