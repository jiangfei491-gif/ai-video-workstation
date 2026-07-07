"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  FiCheckCircle,
  FiDownload,
  FiExternalLink,
  FiLoader,
  FiPlay,
  FiRefreshCw,
  FiXCircle,
} from "react-icons/fi";
import type {
  AiDirectorOrchestratorStep,
  AiDirectorRunOptions,
  AiDirectorRunResult,
} from "@/app/lib/ai-director/types";
import { DEFAULT_AI_DIRECTOR_RUN_OPTIONS } from "@/app/lib/ai-director/types";
import ModuleLeadStrip from "@/app/components/platform/ModuleLeadStrip";
import DirectorModulesPanel from "@/app/components/ai-director/DirectorModulesPanel";
import LoadingButton from "@/app/components/workflows/shared/LoadingButton";
import { getT2VState, useT2VWorkbenchStore } from "@/app/lib/workbench-persist/t2v-store";
import { loadCachedProjectScript } from "@/app/lib/workbench-persist/script-cache";
import {
  getAiDirectorRunState,
  startAiDirectorRun,
  pauseAiDirectorRun,
  resumeAiDirectorRun,
  aiDirectorParamsChangedSincePause,
  subscribeAiDirectorRun,
} from "@/app/lib/ai-director/run-manager";
import {
  hasStaleDownstream,
  isDirectorPlanStale,
  isEditGraphStale,
} from "@/app/lib/ai-director/downstream-stale";
import {
  buildAlignDownstreamOptions,
  buildModuleRerunOptions,
  moduleRerunDisabledReason,
} from "@/app/lib/ai-director/module-rerun";
import type { ModuleId } from "@/app/lib/platform";

function stepIcon(status: AiDirectorOrchestratorStep["status"]) {
  if (status === "running") return <FiLoader className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />;
  if (status === "done") return <FiCheckCircle className="h-3.5 w-3.5 text-[var(--success)]" />;
  if (status === "failed") return <FiXCircle className="h-3.5 w-3.5 text-red-400" />;
  return <span className="text-[10px] text-[var(--text-caption)]">—</span>;
}

function phaseLabel(phase: AiDirectorOrchestratorStep["phase"]): string {
  if (phase === "director") return "编导";
  if (phase === "media") return "批量生图";
  if (phase === "edit") return "剪辑编排";
  return "Director Plan";
}

export default function AiDirectorShell() {
  const { state, patch } = useT2VWorkbenchStore();
  const [options, setOptions] = useState<AiDirectorRunOptions>({
    ...DEFAULT_AI_DIRECTOR_RUN_OPTIONS,
    runBatchImages: state.pipelineMode === "t2i",
  });
  // 运行状态来自模块级单例（切页不中断，回来还能看到进度）
  const runState = useSyncExternalStore(subscribeAiDirectorRun, getAiDirectorRunState, getAiDirectorRunState);
  const running = runState.running;
  const paused = runState.paused;
  const steps = runState.steps;
  const result = runState.result;
  const percent = runState.percent;
  const paramsChangedSincePause = paused && aiDirectorParamsChangedSincePause();
  const [importErr, setImportErr] = useState<string | null>(null);
  const error = importErr ?? runState.error;
  const setError = setImportErr;

  const hasDirector = Boolean(state.director?.storyboard?.length);
  const shotCount = state.director?.storyboard?.length ?? 0;
  const generatedShotCount = useMemo(() => {
    const fromBatch = Object.values(state.batchResults ?? {}).filter(
      (r) => r?.status === "success"
    ).length;
    const fromFrames = Object.keys(state.shotFrames ?? {}).length;
    return Math.max(fromBatch, fromFrames);
  }, [state.batchResults, state.shotFrames]);
  const hasEditGraph = Boolean(state.editGraph?.timeline?.video?.length);
  const hasPlan = Boolean(state.directorPlan?.clips?.length);
  const editStale = isEditGraphStale(state);
  const planStale = isDirectorPlanStale(state);

  const continueHint = useMemo(() => {
    const parts: string[] = [];
    if (editStale) {
      const clipCount = state.editGraph!.timeline.video.length;
      parts.push(
        clipCount !== shotCount
          ? `时间线 ${clipCount} 镜 ≠ 分镜 ${shotCount} 镜`
          : "分镜内容已更新，剪辑工程与当前分镜不一致"
      );
    }
    if (planStale) {
      const planCount = state.directorPlan!.clips.length;
      parts.push(
        planCount !== shotCount
          ? `Plan ${planCount} 镜 ≠ 分镜 ${shotCount} 镜`
          : "分镜内容已更新，Director Plan 与当前分镜不一致"
      );
    }
    if (hasDirector && !editStale && !planStale) {
      parts.push(`编导 ${shotCount} 镜（跳过）`);
    }
    if (generatedShotCount > 0) {
      parts.push(`已生成画面 ${generatedShotCount} 镜（保留）`);
    }
    if (hasEditGraph && !editStale) {
      parts.push(`EditGraph（跳过）`);
    }
    if (hasPlan && !planStale) {
      parts.push(`Director Plan（跳过）`);
    }
    return parts;
  }, [
    hasDirector,
    shotCount,
    generatedShotCount,
    hasEditGraph,
    hasPlan,
    editStale,
    planStale,
    state.editGraph,
    state.directorPlan,
  ]);

  const summary = useMemo(() => {
    if (!result) return null;
    return {
      shots: result.directorResult?.storyboard.length ?? state.director?.storyboard?.length ?? 0,
      images: result.batchImages?.generated ?? generatedShotCount,
      hasGraph: Boolean(result.workbenchPatch.editGraph ?? state.editGraph),
      hasPlan: Boolean(result.workbenchPatch.directorPlan ?? state.directorPlan),
      commands: result.aiCut?.clipAgent.commands.length ?? 0,
    };
  }, [result, state.director, state.editGraph, state.directorPlan]);

  // 运行交给模块级单例：切页/离开也不中断
  const run = useCallback(async () => {
    setImportErr(null);
    if (paused) {
      await resumeAiDirectorRun(options);
    } else {
      await startAiDirectorRun(options);
    }
  }, [options, paused]);

  const runWithOptions = useCallback(async (runOpts: AiDirectorRunOptions) => {
    setImportErr(null);
    await startAiDirectorRun(runOpts);
  }, []);

  const alignDownstream = useCallback(async () => {
    await runWithOptions(buildAlignDownstreamOptions(options));
  }, [options, runWithOptions]);

  const rerunModule = useCallback(
    async (moduleId: ModuleId) => {
      const reason = moduleRerunDisabledReason(moduleId, state);
      if (reason) {
        setImportErr(reason);
        return;
      }
      const runOpts = buildModuleRerunOptions(moduleId, options, state);
      if (!runOpts) {
        setImportErr("该模块不支持一键重跑");
        return;
      }
      setImportErr(null);
      await runWithOptions(runOpts);
    },
    [options, state, runWithOptions]
  );

  // 导入素材脚本：从内容中心缓存把脚本读进来
  const importScript = useCallback(() => {
    const cached = loadCachedProjectScript();
    if (!cached?.text?.trim()) {
      setError("素材库暂无可导入的脚本。请先到内容中心选一条脚本点「一键运行 AI 导演」，或先在创作中心导入。");
      return;
    }
    setError(null);
    patch({
      sourceScript: cached.text,
      sourceScriptLabel: cached.label,
      topic: state.topic?.trim() ? state.topic : cached.label ?? state.topic,
      director: null,
    });
  }, [patch, state.topic]);

  // 一键运行：从内容中心带 ?autorun=1 跳来时，加载好脚本后自动跑一次
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autorun") !== "1") return;
    autoRan.current = true;
    // 清掉 url 上的参数，避免刷新又跑
    window.history.replaceState(null, "", window.location.pathname);
    const s = getT2VState();
    if ((s.sourceScript?.trim() || s.topic?.trim()) && !running) {
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
        <h1 className="workbench-page-title">AI 导演</h1>
        <p className="workbench-page-desc mt-1">
          一键运行：编导分镜 → 批量生图（t2i）→ 剪辑时间线 → Director Plan · GPT-4.1 决策层
        </p>
        <ModuleLeadStrip moduleId="ai-director" showResponsibilities />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {continueHint.length > 0 && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-xs text-[var(--text-secondary)] ${
              hasStaleDownstream(state)
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-[var(--success)]/30 bg-[var(--success)]/5"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                className={`font-medium ${
                  hasStaleDownstream(state)
                    ? "text-amber-600 dark:text-amber-300"
                    : "text-[var(--success)]"
                }`}
              >
                {hasStaleDownstream(state)
                  ? "分镜与剪辑工程不一致 — 请确认是否对齐"
                  : "续跑模式 — 不会从头来一遍"}
              </p>
              {hasStaleDownstream(state) && (
                <button
                  type="button"
                  onClick={() => void alignDownstream()}
                  disabled={running || !state.topic.trim()}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-200"
                >
                  <FiRefreshCw className="h-3 w-3" />
                  对齐
                </button>
              )}
            </div>
            {hasStaleDownstream(state) && (
              <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                {editStale && (
                  <span>
                    EditGraph 分镜数：{state.editGraph!.timeline.video.length} 镜
                  </span>
                )}
                {shotCount > 0 && (
                  <span>分镜脚本数：{shotCount} 镜</span>
                )}
                {planStale && (
                  <span>
                    Director Plan：{state.directorPlan!.clips.length} 镜
                  </span>
                )}
              </div>
            )}
            <p className="mt-1">
              默认只补缺失阶段：{continueHint.join(" · ")}。需要覆盖某模块成果时，点上方模块卡片的「重跑」。
            </p>
          </div>
        )}

        <div className="mb-4">
          <DirectorModulesPanel
            workbench={state}
            running={running}
            onRerun={(id) => void rerunModule(id)}
          />
        </div>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">项目输入</h2>
          <label className="mt-3 block text-xs text-[var(--text-caption)]">
            视频主题
            <textarea
              className="input-field mt-1 min-h-[88px] w-full rounded-lg px-3 py-2 text-sm"
              value={state.topic}
              onChange={(e) => patch({ topic: e.target.value })}
              placeholder="题材、人物、情绪、目标受众…"
              disabled={running}
            />
          </label>
          <div className="mt-3">
            <button
              type="button"
              onClick={importScript}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
            >
              <FiDownload className="h-3.5 w-3.5" />
              {state.sourceScript?.trim() ? "重新导入素材脚本" : "导入素材脚本"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-caption)]">
            {state.pipelineMode === "t2i" ? (
              <>
                <span>
                  目标{" "}
                  {state.targetDurationMinutes != null
                    ? `${state.targetDurationMinutes} 分钟`
                    : "—"}
                </span>
                <span>图片预算 {state.imageBudget} 张</span>
              </>
            ) : (
              <>
                <span>镜头数 {state.shotCount}</span>
                <span>镜长 {state.shotDurationSec}s</span>
              </>
            )}
            <span>模式 {state.pipelineMode}</span>
            {state.sourceScript?.trim() && (
              <span className="text-[var(--accent)]">已导入素材脚本</span>
            )}
            {generatedShotCount > 0 && (
              <span className="text-[var(--success)]">已生成 {generatedShotCount} 镜画面</span>
            )}
            {hasEditGraph && (
              <span className="text-[var(--success)]">已有剪辑时间线</span>
            )}
            {hasPlan && <span className="text-[var(--success)]">已有 Director Plan</span>}
          </div>
          <p className="mt-2 text-[10px] text-[var(--text-caption)]">
            {state.pipelineMode === "t2i" ? "视频时长/图片预算" : "镜头数/镜长"}等可在
            <Link href="/ai-video" className="mx-1 text-[var(--accent)] hover:underline">
              创作中心
            </Link>
            调整；资源在
            <Link href="/resources" className="mx-1 text-[var(--accent)] hover:underline">
              资源中心
            </Link>
            导入。
          </p>
        </section>

        <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">运行选项</h2>
          <div className="mt-3 space-y-2 text-xs">
            {hasDirector && (
              <label className="flex items-center gap-2 text-[var(--danger)]">
                <input
                  type="checkbox"
                  checked={options.forceRerunDirector ?? false}
                  onChange={(e) =>
                    setOptions((o) => ({ ...o, forceRerunDirector: e.target.checked }))
                  }
                  disabled={running}
                />
                强制重新编导（覆盖已有分镜，重跑叙事拆镜）
              </label>
            )}
            {state.pipelineMode === "t2i" && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.runBatchImages !== false}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, runBatchImages: e.target.checked }))
                    }
                    disabled={running}
                  />
                  编导后批量生图（gpt-image，约 3 镜并发）
                </label>
                {generatedShotCount > 0 && (
                  <label className="ml-5 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.forceRerunImages ?? false}
                      onChange={(e) =>
                        setOptions((o) => ({ ...o, forceRerunImages: e.target.checked }))
                      }
                      disabled={running}
                    />
                    强制重新生成全部镜头图
                  </label>
                )}
              </>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.runEditGraph !== false}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, runEditGraph: e.target.checked }))
                }
                disabled={running}
              />
              允许生成/补全剪辑时间线（缺了才跑）
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.runDirectorPlan !== false}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, runDirectorPlan: e.target.checked }))
                }
                disabled={running}
              />
              允许生成/补全 Director Plan（缺了才跑）
            </label>
          </div>
        </section>

        {(running || steps.length > 0) && (
          <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">运行进度</h2>
              {running && <FiLoader className="h-4 w-4 animate-spin text-[var(--accent)]" />}
              <span className="ml-auto text-xs font-medium text-[var(--accent)]">
                {result ? 100 : percent}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-inset)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                style={{ width: `${result ? 100 : percent}%` }}
              />
            </div>
            {running && (
              <p className="mt-1.5 text-[11px] text-[var(--text-caption)]">
                后台运行中，可切到其他页面，回来进度还在。
              </p>
            )}
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto">
              {steps.map((step, i) => (
                <li
                  key={`${step.id}-${i}`}
                  className="flex items-start gap-2 rounded-md px-2 py-1 text-xs hover:bg-[var(--bg-inset)]"
                >
                  <span className="mt-0.5 shrink-0">{stepIcon(step.status)}</span>
                  <div className="min-w-0 flex-1">
                    <span className="mr-2 rounded bg-[var(--bg-inset)] px-1 py-0.5 text-[10px] text-[var(--text-caption)]">
                      {phaseLabel(step.phase)}
                    </span>
                    <span className="font-medium text-[var(--text-primary)]">{step.label}</span>
                    <p className="text-[var(--text-caption)]">{step.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {result && result.status !== "failed" && summary && (
          <section className="mt-4 rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/5 p-4">
            <p className="text-sm font-medium text-[var(--success)]">AI 导演运行完成</p>
            <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
              <li>{summary.shots} 镜分镜 · Prompt 已生成</li>
              {summary.images > 0 && (
                <li>{summary.images} 镜画面已生成（shotFrames）</li>
              )}
              {summary.hasGraph && <li>EditGraph 时间线已写入项目</li>}
              {summary.hasPlan && (
                <li>
                  Director Plan 就绪
                  {summary.commands > 0 && ` · ${summary.commands} 条 OpenCut 命令`}
                </li>
              )}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/ai-video"
                className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
              >
                去生成画面 <FiExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="/ai-edit"
                className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
              >
                去 AI 剪辑 <FiExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="/voice-center"
                className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
              >
                配音中心 <FiExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </section>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--border)] px-6 py-4">
        {paused && (
          <p className="mb-3 text-xs text-amber-600 dark:text-amber-300">
            已暂停 · 可去创作中心改镜头数/主题/资源后再继续
            {paramsChangedSincePause && " · 已检测到参数变更，继续时将按最新设置重跑受影响阶段"}
            {runState.checkpoint?.completedPhases.length
              ? ` · 已完成：${runState.checkpoint.completedPhases.join("、")}`
              : ""}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <LoadingButton
            loading={running}
            loadingText="AI 导演运行中…"
            disabled={!state.topic.trim() || running}
            onClick={() => void run()}
            className="btn-primary inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium"
          >
            {paused ? (
              <>
                <FiPlay className="h-4 w-4" />
                继续运行 AI 导演
              </>
            ) : hasDirector ? (
              <>
                <FiRefreshCw className="h-4 w-4" />
                一键续跑 AI 导演
              </>
            ) : (
              <>
                <FiPlay className="h-4 w-4" />
                一键运行 AI 导演
              </>
            )}
          </LoadingButton>
          {running && (
            <button
              type="button"
              onClick={() => pauseAiDirectorRun()}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-600 dark:text-amber-300 hover:bg-amber-500/20"
            >
              暂停
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
