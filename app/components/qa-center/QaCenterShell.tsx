"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiDownload,
  FiExternalLink,
  FiLoader,
  FiShield,
  FiTerminal,
  FiXCircle,
} from "react-icons/fi";
import type { QaAutoFixResult, QaCenterResult, QaLiveLogEntry } from "@/app/lib/qa-center/types";
import {
  getQaRunState,
  startAutoFix,
  startQa,
  subscribeQaRun,
} from "@/app/lib/qa-center/run-manager";
import {
  DEFAULT_QA_CENTER_UI,
  loadQaCenterUiSettings,
  saveQaCenterUiSettings,
  type QaCenterUiSettings,
} from "@/app/lib/qa-center/client-settings";
import { useT2VWorkbenchStore } from "@/app/lib/workbench-persist/t2v-store";
import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";

type TemplateCatalog = {
  deepseekAvailable: boolean;
  defaultThreshold: number;
  ruleChecks: string[];
  ffmpegChecks: string[];
  features: string[];
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

function scoreColor(score: number): string {
  if (score >= 85) return "text-[var(--success)]";
  if (score >= 70) return "text-amber-500";
  return "text-red-400";
}

function logLevelClass(level: QaLiveLogEntry["level"]): string {
  if (level === "error") return "text-red-400";
  if (level === "warn") return "text-amber-500";
  if (level === "ok") return "text-[var(--success)]";
  return "text-[var(--text-caption)]";
}

function formatLogTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

type FixDecision = "pending" | "approved" | "declined";

export default function QaCenterShell() {
  const { state: workbench } = useT2VWorkbenchStore();
  const [settings, setSettings] = useState<QaCenterUiSettings>(DEFAULT_QA_CENTER_UI);
  const [catalog, setCatalog] = useState<TemplateCatalog | null>(null);
  // 运行状态来自模块级单例：切页不中断，回来还在
  const runState = useSyncExternalStore(subscribeQaRun, getQaRunState, getQaRunState);
  const { result, fixResult, fixDecision, liveLogs, loading, fixLoading, error } = runState;
  const logEndRef = useRef<HTMLDivElement>(null);

  const editGraph = workbench.editGraph as EditGraph | null | undefined;
  const projectTitle = workbench.director?.title?.trim() || "当前项目";
  const hasExport = Boolean(workbench.finalEditVideoUrl?.trim());

  const stats = useMemo(() => {
    const t = editGraph?.timeline;
    if (!t) return null;
    return {
      shots: t.video.length,
      subtitles: t.subtitle.length,
      transitions: t.transitions.length,
      duration: t.durationSec,
    };
  }, [editGraph]);

  useEffect(() => {
    setSettings(loadQaCenterUiSettings());
    void fetch("/api/qa-center/templates")
      .then((r) => r.json())
      .then((data: TemplateCatalog) => setCatalog(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (loading || fixLoading) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveLogs, loading, fixLoading]);

  const updateSettings = (p: Partial<QaCenterUiSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...p };
      saveQaCenterUiSettings(next);
      return next;
    });
  };

  const runQa = useCallback(
    () =>
      startQa({
        optimizeWithAi: settings.optimizeWithAi,
        scoreThreshold: settings.scoreThreshold,
        probeExportedVideo: settings.probeExportedVideo,
      }),
    [settings]
  );

  const autoFixableCount = useMemo(
    () => result?.retry.retryTargets.filter((t) => t.autoFixable).length ?? 0,
    [result]
  );

  const runAutoFix = useCallback((approved: boolean) => startAutoFix(approved), []);

  const displayLogs =
    fixLoading || fixResult
      ? liveLogs
      : result?.liveLog?.length
        ? result.liveLog
        : liveLogs;
  const showLogPanel = loading || fixLoading || displayLogs.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-caption)]">
          <span>项目：{projectTitle}</span>
          {stats && (
            <>
              <span>·</span>
              <span>
                {stats.shots} 镜 · {stats.subtitles} 字幕 · {stats.transitions} 转场 ·{" "}
                {stats.duration.toFixed(1)}s
              </span>
            </>
          )}
          <span>·</span>
          <span>{hasExport ? "已有导出成片" : "未检测到导出成片"}</span>
          <Link href="/canvas" className="ml-auto inline-flex items-center gap-1 text-[var(--accent)] hover:underline">
            去无限画布 <FiExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">检测引擎</h2>
            <ul className="mt-3 space-y-2 text-xs">
              <li className="text-[var(--text-secondary)]">
                Rule Engine：{(catalog?.ruleChecks ?? []).join(" · ")}
              </li>
              <li className="text-[var(--text-secondary)]">
                FFmpeg：{(catalog?.ffmpegChecks ?? []).join(" · ")}
              </li>
              <li className="flex items-center gap-2">
                {catalog?.deepseekAvailable ? (
                  <FiCheckCircle className="h-3.5 w-3.5 text-[var(--success)]" />
                ) : (
                  <FiXCircle className="h-3.5 w-3.5 text-[var(--text-caption)]" />
                )}
                DeepSeek QA Agent（需 DEEPSEEK_API_KEY）
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">质检参数</h2>
            <div className="mt-3 space-y-3">
              <label className="block text-xs text-[var(--text-caption)]">
                参考合格线
                <span className="ml-1 text-[10px] text-[var(--text-caption)]">
                  （仅供参考，不自动回流）
                </span>
                <input
                  type="number"
                  min={50}
                  max={100}
                  value={settings.scoreThreshold}
                  onChange={(e) => updateSettings({ scoreThreshold: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={settings.optimizeWithAi}
                  onChange={(e) => updateSettings({ optimizeWithAi: e.target.checked })}
                />
                启用 DeepSeek 智能评分
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={settings.probeExportedVideo}
                  onChange={(e) => updateSettings({ probeExportedVideo: e.target.checked })}
                />
                探测已导出成片（FFmpeg blackdetect）
              </label>
            </div>
          </section>

          {showLogPanel && (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 xl:col-span-2">
              <div className="flex items-center gap-2">
                <FiTerminal className="h-4 w-4 text-[var(--text-caption)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">自检实时日志</h2>
                {(loading || fixLoading) && (
                  <FiLoader className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
                )}
              </div>
              <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2 font-mono text-[10px] leading-relaxed">
                {displayLogs.length === 0 && (loading || fixLoading) && (
                  <p className="text-[var(--text-caption)]">等待日志…</p>
                )}
                {displayLogs.map((log, i) => (
                  <div key={`${log.at}-${i}`} className="flex gap-2 py-0.5">
                    <span className="shrink-0 text-[var(--text-caption)]">
                      {formatLogTime(log.at)}
                    </span>
                    <span className="shrink-0 uppercase text-[var(--text-caption)]">
                      [{log.stage}]
                    </span>
                    <span className={logLevelClass(log.level)}>{log.message}</span>
                    {log.detail && (
                      <span className="truncate text-[var(--text-caption)]">— {log.detail}</span>
                    )}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
              <p className="mt-2 text-[10px] text-[var(--text-caption)]">
                低于参考线不会自动回炉；系统会列出建议环节，等您拍板「同意自动修复」后才定点重跑。
              </p>
            </section>
          )}

          {result && (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 xl:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">质检结果</h2>
                  <p className={`mt-1 text-3xl font-bold ${scoreColor(result.score.overall)}`}>
                    Quality Score {result.score.overall}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-caption)]">
                    规则 {result.score.rules}
                    {result.score.rhythm != null && ` · 节奏 ${result.score.rhythm}`}
                    {result.score.shots != null && ` · 镜头 ${result.score.shots}`}
                    {result.score.subtitles != null && ` · 字幕 ${result.score.subtitles}`}
                    {result.score.music != null && ` · 音乐 ${result.score.music}`}
                    {result.score.effects != null && ` · 特效 ${result.score.effects}`}
                  </p>
                </div>
                {result.retry.belowThreshold ? (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">
                    <FiAlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{result.retry.reason}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 px-3 py-2 text-xs text-[var(--success)]">
                    <FiCheckCircle className="h-4 w-4 shrink-0" />
                    <span>{result.retry.reason}</span>
                  </div>
                )}
              </div>

              {result.retry.belowThreshold && result.retry.retryTargets.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-xs font-medium text-[var(--text-primary)]">
                    发现以下问题环节 — 是否同意系统自动定点修复？
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--text-caption)]">
                    共 {result.retry.retryTargets.length} 项建议，其中 {autoFixableCount}{" "}
                    项可自动执行；其余需 AI 导演 Patch Plan 或人工处理，将自动跳过。
                  </p>
                  <ul className="mt-2 space-y-2">
                    {result.retry.retryTargets.map((t, i) => (
                      <li
                        key={`${t.module}-${t.action}-${i}`}
                        className="rounded-md border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-[var(--text-primary)]">{t.label}</p>
                          <span
                            className={
                              t.autoFixable
                                ? "rounded bg-[var(--success)]/10 px-1.5 py-0.5 text-[10px] text-[var(--success)]"
                                : "rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-300"
                            }
                          >
                            {t.autoFixable ? "可自动修复" : "需导演/人工"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[var(--text-caption)]">
                          {t.action} · {t.reason}
                        </p>
                      </li>
                    ))}
                  </ul>

                  {fixDecision === "pending" && !fixLoading && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={autoFixableCount === 0}
                        onClick={() => void runAutoFix(true)}
                        className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium disabled:opacity-50"
                      >
                        <FiCheckCircle className="h-3.5 w-3.5" />
                        同意，自动定点修复
                      </button>
                      <button
                        type="button"
                        onClick={() => void runAutoFix(false)}
                        className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs"
                      >
                        <FiXCircle className="h-3.5 w-3.5" />
                        不同意，暂不处理
                      </button>
                    </div>
                  )}

                  {fixLoading && (
                    <p className="mt-3 flex items-center gap-2 text-xs text-[var(--accent)]">
                      <FiLoader className="h-3.5 w-3.5 animate-spin" />
                      正在自动修复…
                    </p>
                  )}

                  {fixDecision === "declined" && (
                    <p className="mt-3 text-xs text-[var(--text-caption)]">
                      您选择了暂不处理。可调整参数后重新运行质检。
                    </p>
                  )}

                  {fixResult && fixDecision === "approved" && (
                    <div className="mt-3 space-y-1 text-xs">
                      <p
                        className={
                          fixResult.status === "success"
                            ? "text-[var(--success)]"
                            : fixResult.status === "partial"
                              ? "text-amber-500"
                              : "text-red-400"
                        }
                      >
                        {fixResult.status === "success" && "自动修复已完成，时间线已写回项目。"}
                        {fixResult.status === "partial" &&
                          "部分环节已修复，请查看日志；未支持项已跳过。"}
                        {fixResult.status === "failed" && (fixResult.error ?? "自动修复失败")}
                      </p>
                      {fixResult.steps.map((step, i) => (
                        <p key={i} className="text-[10px] text-[var(--text-caption)]">
                          [{step.status}] {step.target.label} — {step.message}
                        </p>
                      ))}
                      {(fixResult.status === "success" || fixResult.status === "partial") && (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => void runQa()}
                          className="btn-secondary mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                        >
                          重新运行质检
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {result.suggestions.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-[var(--text-primary)]">建议</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-[var(--text-secondary)]">
                    {result.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.issues.length > 0 && (
                <div className="mt-4 max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2">
                  {result.issues.map((issue, i) => (
                    <p key={i} className="text-[10px] text-[var(--text-caption)]">
                      [{issue.severity}] {issue.category}: {issue.message}
                    </p>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadText("qa-report.json", result.report.json)}
                  className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                >
                  <FiDownload className="h-3.5 w-3.5" />JSON
                </button>
                <button
                  type="button"
                  onClick={() => downloadText("qa-report.md", result.report.markdown)}
                  className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                >
                  <FiDownload className="h-3.5 w-3.5" />Markdown
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--border)] px-6 py-4">
        <button
          type="button"
          disabled={loading || fixLoading || !stats?.shots}
          onClick={() => void runQa()}
          className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiShield className="h-4 w-4" />}
          {loading ? "检测中…" : "运行质检"}
        </button>
      </div>
    </div>
  );
}
