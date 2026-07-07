"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiCheckCircle,
  FiDownload,
  FiExternalLink,
  FiLoader,
  FiMusic,
  FiRefreshCw,
  FiUpload,
  FiXCircle,
} from "react-icons/fi";
import type { BgmLibraryEntry, MusicCenterResult, MusicStyleTemplate } from "@/app/lib/music-center/types";
import {
  DEFAULT_MUSIC_CENTER_UI,
  loadMusicCenterUiSettings,
  saveMusicCenterUiSettings,
  type MusicCenterUiSettings,
} from "@/app/lib/music-center/client-settings";
import { getT2VState, useT2VWorkbenchStore } from "@/app/lib/workbench-persist/t2v-store";
import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";

type TemplateCatalog = {
  styles: { id: MusicStyleTemplate; label: string }[];
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

export default function MusicCenterShell() {
  const { state: workbench, patch } = useT2VWorkbenchStore();
  const [settings, setSettings] = useState<MusicCenterUiSettings>(DEFAULT_MUSIC_CENTER_UI);
  const [catalog, setCatalog] = useState<TemplateCatalog | null>(null);
  const [library, setLibrary] = useState<BgmLibraryEntry[]>([]);
  const [lastResult, setLastResult] = useState<MusicCenterResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const editGraph = workbench.editGraph as EditGraph | null | undefined;
  const projectTitle = workbench.director?.title?.trim() || "当前项目";

  const musicStats = useMemo(() => {
    const clips = editGraph?.timeline.music ?? [];
    const bgm = editGraph?.mediaPool.find((p) => p.kind === "music");
    return { clipCount: clips.length, hasBgm: Boolean(bgm?.url) };
  }, [editGraph]);

  const refreshLibrary = useCallback(async () => {
    const res = await fetch("/api/music-center/library");
    const data = (await res.json()) as { bgm?: BgmLibraryEntry[] };
    if (data.bgm) setLibrary(data.bgm);
  }, []);

  useEffect(() => {
    setSettings(loadMusicCenterUiSettings());
    void refreshLibrary();
    void fetch("/api/music-center/templates")
      .then((r) => r.json())
      .then((data: TemplateCatalog) => setCatalog(data))
      .catch(() => {});
  }, [refreshLibrary]);

  const updateSettings = (p: Partial<MusicCenterUiSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...p };
      saveMusicCenterUiSettings(next);
      return next;
    });
  };

  const runRecommend = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/music-center/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workbench: getT2VState(),
          optimizeWithAi: settings.optimizeWithAi,
        }),
      });
      const data = (await res.json()) as { plan?: MusicCenterResult["plan"]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "推荐失败");
      if (data.plan) {
        updateSettings({ selectedBgmFilename: data.plan.bgmFilename });
        setLastResult({
          taskId: "preview",
          status: "success",
          music: [],
          mediaRefId: "bgm-main",
          plan: data.plan,
          exports: { json: "" },
          openCut: { musicTracks: [], commands: [] },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const runProjectMusic = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await fetch("/api/music-center/workbench", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workbench: getT2VState(),
          styleTemplate: settings.styleTemplate,
          optimizeWithAi: settings.optimizeWithAi,
          baseVolume: settings.baseVolume,
          duckUnderVoice: settings.duckUnderVoice,
          duckAmount: settings.duckAmount,
          fadeInSec: settings.fadeInSec,
          fadeOutSec: settings.fadeOutSec,
          beatSync: settings.beatSync,
          bpm: settings.bpm,
          bgmFilename: settings.selectedBgmFilename || undefined,
        }),
      });
      const data = (await res.json()) as {
        editGraph?: EditGraph;
        result?: MusicCenterResult;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "音乐生成失败");
      if (data.editGraph) patch({ editGraph: data.editGraph });
      if (data.result) setLastResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [patch, settings]);

  const uploadBgm = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/music-center/upload", { method: "POST", body: form });
      const data = (await res.json()) as { filename?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "上传失败");
      await refreshLibrary();
      if (data.filename) updateSettings({ selectedBgmFilename: data.filename });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

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
          <span>音乐轨 {musicStats.clipCount} 段</span>
          <span>·</span>
          <span>{musicStats.hasBgm ? "已挂载 BGM" : "未挂载 BGM"}</span>
          <Link href="/canvas" className="ml-auto inline-flex items-center gap-1 text-[var(--accent)] hover:underline">
            去无限画布 <FiExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">BGM 库</h2>
                <p className="mt-0.5 text-xs text-[var(--text-caption)]">
                  工作区 BGM 库 · DeepSeek 从库中选曲
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => void refreshLibrary()}
                  className="btn-secondary rounded-lg px-2 py-1.5 text-xs"
                >
                  <FiRefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="btn-secondary inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs"
                >
                  {uploading ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiUpload className="h-3.5 w-3.5" />}
                  上传
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadBgm(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
              {library.length === 0 ? (
                <li className="text-xs text-[var(--text-caption)]">库为空，请上传或放入 BGM 文件夹</li>
              ) : (
                library.map((item) => (
                  <li key={item.filename}>
                    <button
                      type="button"
                      onClick={() => updateSettings({ selectedBgmFilename: item.filename })}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                        settings.selectedBgmFilename === item.filename
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                          : "border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50"
                      }`}
                    >
                      {item.filename}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">DeepSeek Music Agent</h2>
            <p className="mt-0.5 text-xs text-[var(--text-caption)]">
              推荐 BGM · 风格 · 高潮点 · 卡点 · 音量策略 · 音效建议
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
              <li className="text-[var(--text-caption)]">未配置时自动规则回退选曲</li>
            </ul>
            <button
              type="button"
              disabled={loading}
              onClick={() => void runRecommend()}
              className="btn-secondary mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
            >
              {loading ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiMusic className="h-3.5 w-3.5" />}
              预览 AI 推荐
            </button>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 xl:col-span-2">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">音乐参数</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-xs text-[var(--text-caption)]">
                风格模板
                <select
                  value={settings.styleTemplate}
                  onChange={(e) =>
                    updateSettings({ styleTemplate: e.target.value as MusicStyleTemplate })
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
                >
                  {(catalog?.styles ?? [{ id: "documentary", label: "纪录片" }]).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-[var(--text-caption)]">
                基础音量
                <input
                  type="number"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={settings.baseVolume}
                  onChange={(e) => updateSettings({ baseVolume: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs text-[var(--text-caption)]">
                BPM（卡点）
                <input
                  type="number"
                  min={60}
                  max={180}
                  value={settings.bpm}
                  onChange={(e) => updateSettings({ bpm: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-xs sm:col-span-2">
                <input
                  type="checkbox"
                  checked={settings.optimizeWithAi}
                  onChange={(e) => updateSettings({ optimizeWithAi: e.target.checked })}
                />
                启用 DeepSeek 智能推荐
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={settings.duckUnderVoice}
                  onChange={(e) => updateSettings({ duckUnderVoice: e.target.checked })}
                />
                配音 Ducking
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={settings.beatSync}
                  onChange={(e) => updateSettings({ beatSync: e.target.checked })}
                />
                自动 BPM 卡点
              </label>
            </div>
          </section>

          {lastResult?.plan && (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 xl:col-span-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">推荐结果</h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                BGM：{lastResult.plan.bgmLabel} · 风格：{lastResult.plan.style}
              </p>
              {lastResult.plan.rationale.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-[var(--text-caption)]">
                  {lastResult.plan.rationale.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
              {lastResult.exports.json && (
                <button
                  type="button"
                  onClick={() => downloadText("music-timeline.json", lastResult.exports.json)}
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
          disabled={loading}
          onClick={() => void runProjectMusic()}
          className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiMusic className="h-4 w-4" />}
          {loading ? "生成中…" : "为当前项目生成音乐时间轴"}
        </button>
      </div>
    </div>
  );
}
