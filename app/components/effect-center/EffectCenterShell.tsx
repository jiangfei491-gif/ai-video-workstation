"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiDownload,
  FiExternalLink,
  FiLoader,
  FiRefreshCw,
  FiXCircle,
  FiZap,
} from "react-icons/fi";
import type {
  EffectCenterResult,
  EffectPlan,
  EffectPresetId,
} from "@/app/lib/effect-center/types";
import type { TransitionType } from "@/app/lib/auto-edit/types";
import {
  DEFAULT_EFFECT_CENTER_UI,
  loadEffectCenterUiSettings,
  saveEffectCenterUiSettings,
  type EffectCenterUiSettings,
} from "@/app/lib/effect-center/client-settings";
import { getT2VState, useT2VWorkbenchStore } from "@/app/lib/workbench-persist/t2v-store";
import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";

type TemplateCatalog = {
  presets: { id: EffectPresetId; label: string }[];
  transitions: { id: TransitionType; label: string }[];
  clipEffects: { id: string; label: string }[];
  deepseekAvailable: boolean;
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

export default function EffectCenterShell() {
  const { state: workbench, patch } = useT2VWorkbenchStore();
  const [settings, setSettings] = useState<EffectCenterUiSettings>(DEFAULT_EFFECT_CENTER_UI);
  const [catalog, setCatalog] = useState<TemplateCatalog | null>(null);
  const [previewPlan, setPreviewPlan] = useState<EffectPlan | null>(null);
  const [lastResult, setLastResult] = useState<EffectCenterResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editGraph = workbench.editGraph as EditGraph | null | undefined;
  const projectTitle = workbench.director?.title?.trim() || "当前项目";

  const effectStats = useMemo(() => {
    const video = editGraph?.timeline.video ?? [];
    const transitions = editGraph?.timeline.transitions ?? [];
    const effectCount = video.reduce((n, c) => n + (c.effects?.length ?? 0), 0);
    return { shots: video.length, transitions: transitions.length, effects: effectCount };
  }, [editGraph]);

  useEffect(() => {
    setSettings(loadEffectCenterUiSettings());
    void fetch("/api/effect-center/templates")
      .then((r) => r.json())
      .then((data: TemplateCatalog) => setCatalog(data))
      .catch(() => {});
  }, []);

  const updateSettings = (p: Partial<EffectCenterUiSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...p };
      saveEffectCenterUiSettings(next);
      return next;
    });
  };

  const runRecommend = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/effect-center/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workbench: getT2VState(),
          optimizeWithAi: settings.optimizeWithAi,
          preset: settings.preset,
        }),
      });
      const data = (await res.json()) as { plan?: EffectPlan; error?: string };
      if (!res.ok) throw new Error(data.error ?? "推荐失败");
      if (data.plan) setPreviewPlan(data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const runProjectEffects = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await fetch("/api/effect-center/workbench", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workbench: getT2VState(),
          preset: settings.preset,
          optimizeWithAi: settings.optimizeWithAi,
          defaultTransition: settings.defaultTransition,
          defaultTransitionMs: settings.defaultTransitionMs,
        }),
      });
      const data = (await res.json()) as {
        editGraph?: EditGraph;
        result?: EffectCenterResult;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "特效生成失败");
      if (data.editGraph) patch({ editGraph: data.editGraph });
      if (data.result) {
        setLastResult(data.result);
        setPreviewPlan(data.result.plan ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [patch, settings]);

  const displayPlan = lastResult?.plan ?? previewPlan;

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
          <span>·</span>
          <span>{effectStats.shots} 镜 · {effectStats.transitions} 转场 · {effectStats.effects} 镜头特效</span>
          <Link href="/canvas" className="ml-auto inline-flex items-center gap-1 text-[var(--accent)] hover:underline">
            去无限画布 <FiExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">DeepSeek Effect Agent</h2>
            <p className="mt-0.5 text-xs text-[var(--text-caption)]">
              分析：哪里放大 · 闪白 · 抖动 · 加转场
            </p>
            <ul className="mt-3 space-y-2 text-xs">
              <li className="flex items-center gap-2">
                {catalog?.deepseekAvailable ? (
                  <FiCheckCircle className="h-3.5 w-3.5 text-[var(--success)]" />
                ) : (
                  <FiXCircle className="h-3.5 w-3.5 text-[var(--text-caption)]" />
                )}
                DeepSeek Agent（需 DEEPSEEK_API_KEY）
              </li>
              <li className="text-[var(--text-caption)]">未配置时使用规则模板回退</li>
            </ul>
            <button
              type="button"
              disabled={loading || effectStats.shots < 2}
              onClick={() => void runRecommend()}
              className="btn-secondary mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {loading ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiRefreshCw className="h-3.5 w-3.5" />}
              预览 AI 方案
            </button>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">特效能力</h2>
            <div className="mt-2 flex flex-wrap gap-1">
              {(catalog?.clipEffects ?? []).map((e) => (
                <span
                  key={e.id}
                  className="rounded border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]"
                >
                  {e.label}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--text-caption)]">
              转场：{(catalog?.transitions ?? []).slice(0, 6).map((t) => t.label).join(" · ")}…
            </p>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 xl:col-span-2">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">特效参数</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs text-[var(--text-caption)]">
                预设模板
                <select
                  value={settings.preset}
                  onChange={(e) => updateSettings({ preset: e.target.value as EffectPresetId })}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
                >
                  {(catalog?.presets ?? [{ id: "documentary", label: "纪录片" }]).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-[var(--text-caption)]">
                默认转场
                <select
                  value={settings.defaultTransition}
                  onChange={(e) =>
                    updateSettings({ defaultTransition: e.target.value as TransitionType })
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
                >
                  {(catalog?.transitions ?? [{ id: "crossfade", label: "交叉叠化" }]).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-[var(--text-caption)]">
                转场时长 (ms)
                <input
                  type="number"
                  min={0}
                  max={2000}
                  step={50}
                  value={settings.defaultTransitionMs}
                  onChange={(e) =>
                    updateSettings({ defaultTransitionMs: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex items-end gap-2 pb-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={settings.optimizeWithAi}
                  onChange={(e) => updateSettings({ optimizeWithAi: e.target.checked })}
                />
                启用 DeepSeek 智能分析
              </label>
            </div>
          </section>

          {displayPlan && (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 xl:col-span-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">方案预览</h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                预设：{displayPlan.preset} · {displayPlan.transitions.length} 处转场 ·{" "}
                {displayPlan.clipEffects.length} 处镜头特效
              </p>
              {displayPlan.rationale.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-[var(--text-caption)]">
                  {displayPlan.rationale.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
              {displayPlan.transitions.length > 0 && (
                <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2 text-[10px] text-[var(--text-secondary)]">
                  {displayPlan.transitions.map((t) => (
                    <p key={t.afterClipId}>
                      镜 {t.afterClipId} → {t.type} ({t.durationMs}ms)：{t.rationale}
                    </p>
                  ))}
                </div>
              )}
              {lastResult?.exports.json && (
                <button
                  type="button"
                  onClick={() => downloadText("effect-timeline.json", lastResult.exports.json)}
                  className="btn-secondary mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                >
                  <FiDownload className="h-3.5 w-3.5" />导出 JSON
                </button>
              )}
            </section>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--border)] px-6 py-4">
        <button
          type="button"
          disabled={loading || effectStats.shots < 1}
          onClick={() => void runProjectEffects()}
          className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiZap className="h-4 w-4" />}
          {loading ? "生成中…" : "为当前项目生成特效时间轴"}
        </button>
      </div>
    </div>
  );
}
