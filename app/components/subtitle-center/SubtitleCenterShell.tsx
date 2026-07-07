"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiDownload,
  FiExternalLink,
  FiLoader,
  FiRefreshCw,
  FiType,
  FiXCircle,
} from "react-icons/fi";
import type {
  SubtitleAnimationId,
  SubtitleCenterLanguage,
  SubtitleCenterResult,
  SubtitleStyleTemplate,
} from "@/app/lib/subtitle-center/types";
import {
  DEFAULT_SUBTITLE_CENTER_UI,
  loadSubtitleCenterUiSettings,
  saveSubtitleCenterUiSettings,
  type SubtitleCenterUiSettings,
} from "@/app/lib/subtitle-center/client-settings";
import { getT2VState, useT2VWorkbenchStore } from "@/app/lib/workbench-persist/t2v-store";
import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";

type TemplateCatalog = {
  styles: { id: SubtitleStyleTemplate; label: string }[];
  animations: { id: SubtitleAnimationId; label: string }[];
  languages: { id: SubtitleCenterLanguage; label: string; supported: boolean }[];
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

export default function SubtitleCenterShell() {
  const { state: workbench, patch } = useT2VWorkbenchStore();
  const [settings, setSettings] = useState<SubtitleCenterUiSettings>(DEFAULT_SUBTITLE_CENTER_UI);
  const [catalog, setCatalog] = useState<TemplateCatalog | null>(null);
  const [lastResult, setLastResult] = useState<SubtitleCenterResult | null>(null);
  const [deepseekOk, setDeepseekOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editGraph = workbench.editGraph as EditGraph | null | undefined;
  const projectTitle = workbench.director?.title?.trim() || "当前项目";

  const subtitleStats = useMemo(() => {
    const clips = editGraph?.timeline.subtitle ?? [];
    return { total: clips.length, withText: clips.filter((c) => c.subtitle?.text?.trim()).length };
  }, [editGraph]);

  useEffect(() => {
    setSettings(loadSubtitleCenterUiSettings());
    void fetch("/api/subtitle-center/templates")
      .then((r) => r.json())
      .then((data: TemplateCatalog) => setCatalog(data))
      .catch(() => {});
  }, []);

  const updateSettings = (p: Partial<SubtitleCenterUiSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...p };
      saveSubtitleCenterUiSettings(next);
      return next;
    });
  };

  const runProjectSubtitles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await fetch("/api/subtitle-center/workbench", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workbench: getT2VState(),
          language: settings.language,
          styleTemplate: settings.styleTemplate,
          animation: settings.animation,
          optimizeWithAi: settings.optimizeWithAi,
          whisperAlign: true,
          options: {
            maxCharsPerLine: settings.maxCharsPerLine,
            maxLines: settings.maxLines,
            primaryLang: settings.language,
          },
        }),
      });
      const data = (await res.json()) as {
        editGraph?: EditGraph;
        result?: SubtitleCenterResult;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "字幕生成失败");
      if (data.editGraph) patch({ editGraph: data.editGraph });
      if (data.result) {
        setLastResult(data.result);
        setDeepseekOk(settings.optimizeWithAi);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [patch, settings]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">字幕引擎</h2>
            <p className="mt-0.5 text-xs text-[var(--text-caption)]">
              DeepSeek 智能优化 · Rule Engine 生成 SRT/ASS/WebVTT/JSON · OpenCut 适配
            </p>
            <ul className="mt-3 space-y-2 text-xs">
              <li className="flex items-center gap-2">
                {deepseekOk === null ? (
                  <FiType className="h-3.5 w-3.5 text-[var(--text-caption)]" />
                ) : deepseekOk ? (
                  <FiCheckCircle className="h-3.5 w-3.5 text-[var(--success)]" />
                ) : (
                  <FiXCircle className="h-3.5 w-3.5 text-[var(--text-caption)]" />
                )}
                DeepSeek Agent（需 DEEPSEEK_API_KEY）
              </li>
              <li className="text-[var(--text-caption)]">Whisper 打轴（需 OPENAI_API_KEY）</li>
              <li className="text-[var(--text-caption)]">OpenCut insertSubtitle 命令自动输出</li>
            </ul>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">字幕参数</h2>
            <div className="mt-3 space-y-3">
              <label className="block text-xs text-[var(--text-caption)]">
                语言
                <select
                  value={settings.language}
                  onChange={(e) =>
                    updateSettings({ language: e.target.value as SubtitleCenterLanguage })
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
                >
                  {(catalog?.languages ?? [{ id: "zh", label: "中文", supported: true }]).map(
                    (l) => (
                      <option key={l.id} value={l.id} disabled={!l.supported}>
                        {l.label}
                        {!l.supported ? "（即将支持）" : ""}
                      </option>
                    )
                  )}
                </select>
              </label>
              <label className="block text-xs text-[var(--text-caption)]">
                风格模板
                <select
                  value={settings.styleTemplate}
                  onChange={(e) =>
                    updateSettings({ styleTemplate: e.target.value as SubtitleStyleTemplate })
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
                >
                  {(catalog?.styles ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-[var(--text-caption)]">
                动画
                <select
                  value={settings.animation}
                  onChange={(e) =>
                    updateSettings({ animation: e.target.value as SubtitleAnimationId })
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
                >
                  {(catalog?.animations ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={settings.optimizeWithAi}
                  onChange={(e) => updateSettings({ optimizeWithAi: e.target.checked })}
                />
                启用 DeepSeek 智能优化
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-[var(--text-caption)]">
                  每行字数
                  <input
                    type="number"
                    min={8}
                    max={32}
                    value={settings.maxCharsPerLine}
                    onChange={(e) =>
                      updateSettings({ maxCharsPerLine: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs text-[var(--text-caption)]">
                  最大行数
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={settings.maxLines}
                    onChange={(e) => updateSettings({ maxLines: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">项目字幕</h2>
              <p className="mt-0.5 text-xs text-[var(--text-caption)]">
                {projectTitle} · 字幕轨 {subtitleStats.withText}/{subtitleStats.total} 条
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/voice-center" className="btn-secondary rounded-lg px-3 py-2 text-xs">
                配音中心
              </Link>
              <Link href="/canvas" className="btn-secondary flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs">
                <FiExternalLink className="h-3.5 w-3.5" />
                无限画布
              </Link>
              <button
                type="button"
                disabled={loading || !editGraph}
                onClick={() => void runProjectSubtitles()}
                className="btn-primary flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs disabled:opacity-50"
              >
                {loading ? (
                  <FiLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FiRefreshCw className="h-3.5 w-3.5" />
                )}
                生成 / 优化项目字幕
              </button>
            </div>
          </div>
          {!editGraph && (
            <p className="mt-3 text-xs text-[var(--text-caption)]">
              请先在无限画布建立剪辑工程，并在配音中心生成配音后再来生成字幕。
            </p>
          )}
        </section>

        {lastResult && (
          <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">导出</h2>
            {lastResult.qa.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-amber-500/90">
                {lastResult.qa.slice(0, 5).map((q, i) => (
                  <li key={i}>
                    [{q.severity}] {q.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ["srt", lastResult.exports.srt],
                  ["ass", lastResult.exports.ass],
                  ["vtt", lastResult.exports.webvtt],
                  ["json", lastResult.exports.json],
                ] as const
              ).map(([ext, content]) => (
                <button
                  key={ext}
                  type="button"
                  disabled={!content.trim()}
                  onClick={() => downloadText(`${projectTitle}.${ext}`, content)}
                  className="btn-secondary flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs disabled:opacity-50"
                >
                  <FiDownload className="h-3.5 w-3.5" />
                  {ext.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-[var(--text-caption)]">
              OpenCut 命令 {lastResult.openCut.commands.length} 条 · 风格 {lastResult.style} ·
              动画 {lastResult.animation}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
