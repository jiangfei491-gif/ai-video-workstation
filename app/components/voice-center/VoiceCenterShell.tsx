"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiExternalLink,
  FiLoader,
  FiMic,
  FiPlay,
  FiRefreshCw,
  FiXCircle,
} from "react-icons/fi";
import type {
  VoiceCategory,
  VoiceCenterProviderId,
  VoiceCenterResult,
  VoiceQualityHint,
} from "@/app/lib/voice-center/types";
import { VOICE_CATEGORY_LABEL, type VoiceLibraryEntry } from "@/app/lib/voice-center/voice-library";
import {
  DEFAULT_VOICE_CENTER_UI,
  loadVoiceCenterUiSettings,
  saveVoiceCenterUiSettings,
  type VoiceCenterUiSettings,
} from "@/app/lib/voice-center/client-settings";
import { getT2VState, useT2VWorkbenchStore } from "@/app/lib/workbench-persist/t2v-store";
import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";

type ProviderRow = {
  id: VoiceCenterProviderId;
  label: string;
  kind: "local" | "cloud";
  enabled: boolean;
  isDefault?: boolean;
  health: { ok: boolean; message?: string; latencyMs?: number };
};

type LogRow = {
  taskId: string;
  provider: VoiceCenterProviderId;
  status: string;
  durationMs: number;
  error?: string;
  endedAt: string;
};

const PROVIDER_AUTO = "" as const;

export default function VoiceCenterShell() {
  const { state: workbench, patch } = useT2VWorkbenchStore();
  const [settings, setSettings] = useState<VoiceCenterUiSettings>(DEFAULT_VOICE_CENTER_UI);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [voices, setVoices] = useState<VoiceLibraryEntry[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [voiceQuery, setVoiceQuery] = useState("");
  const [voiceCategory, setVoiceCategory] = useState<VoiceCategory | "">("");
  const [previewText, setPreviewText] = useState("你好，欢迎来到 AI Cut 配音中心。");
  const [previewResult, setPreviewResult] = useState<VoiceCenterResult | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [projectLoading, setProjectLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editGraph = workbench.editGraph as EditGraph | null | undefined;
  const projectTitle = workbench.director?.title?.trim() || "当前项目";

  const voiceStats = useMemo(() => {
    const voiceClips = editGraph?.timeline.voice ?? [];
    const pool = editGraph?.mediaPool ?? [];
    let ready = 0;
    let pending = 0;
    for (const clip of voiceClips) {
      const item = pool.find((p) => p.id === (clip.mediaRefId ?? ""));
      if (item?.status === "ready" && item.url) ready += 1;
      else pending += 1;
    }
    return { ready, pending, total: voiceClips.length };
  }, [editGraph]);

  const refreshProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const res = await fetch("/api/voice-center/providers");
      const data = (await res.json()) as { providers?: ProviderRow[] };
      if (data.providers) setProviders(data.providers);
    } catch {
      /* ignore */
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  const refreshVoices = useCallback(async () => {
    const params = new URLSearchParams();
    if (voiceQuery.trim()) params.set("q", voiceQuery.trim());
    if (voiceCategory) params.set("category", voiceCategory);
    const res = await fetch(`/api/voice-center/voices?${params}`);
    const data = (await res.json()) as { voices?: VoiceLibraryEntry[] };
    if (data.voices) setVoices(data.voices);
  }, [voiceQuery, voiceCategory]);

  const refreshLogs = useCallback(async () => {
    const res = await fetch("/api/voice-center/logs?limit=20");
    const data = (await res.json()) as { logs?: LogRow[] };
    if (data.logs) setLogs(data.logs);
  }, []);

  useEffect(() => {
    setSettings(loadVoiceCenterUiSettings());
    void refreshProviders();
    void refreshLogs();
  }, [refreshProviders, refreshLogs]);

  useEffect(() => {
    void refreshVoices();
  }, [refreshVoices]);

  const updateSettings = (patchSettings: Partial<VoiceCenterUiSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patchSettings };
      saveVoiceCenterUiSettings(next);
      return next;
    });
  };

  const runPreview = async () => {
    setPreviewLoading(true);
    setError(null);
    setPreviewResult(null);
    try {
      const res = await fetch("/api/voice-center/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: {
            id: `preview-${Date.now()}`,
            text: previewText,
            voiceId: settings.voiceId,
            provider: settings.provider || undefined,
            ultraQuality: settings.ultraQuality,
            quality: settings.quality,
            speed: settings.speed,
          },
        }),
      });
      const data = (await res.json()) as VoiceCenterResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "试听失败");
      setPreviewResult(data);
      void refreshLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewLoading(false);
    }
  };

  const runProjectVoice = async () => {
    setProjectLoading(true);
    setError(null);
    try {
      const wb = getT2VState();
      const res = await fetch("/api/voice-center/workbench", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workbench: wb,
          voiceId: settings.voiceId,
          provider: settings.provider || undefined,
          ultraQuality: settings.ultraQuality,
          quality: settings.quality,
        }),
      });
      const data = (await res.json()) as {
        editGraph?: EditGraph;
        synthesized?: number[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "项目配音失败");
      if (data.editGraph) {
        patch({ editGraph: data.editGraph, editVoiceId: settings.voiceId });
      }
      const count = data.synthesized?.length ?? 0;
      if (count > 0) {
        window.alert(`已为 ${count} 个镜头生成配音，可在无限画布时间轴试听`);
      } else {
        window.alert("配音已全部就绪，无需重新生成");
      }
      void refreshLogs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      window.alert(msg);
    } finally {
      setProjectLoading(false);
    }
  };

  const providerOptions = providers.filter((p) => p.enabled);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          {/* 引擎状态 */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">配音引擎</h2>
                <p className="mt-0.5 text-xs text-[var(--text-caption)]">
                  默认链 F5-TTS → Fish Speech → CosyVoice →（超高质量）ElevenLabs
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refreshProviders()}
                className="btn-secondary flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs"
              >
                {loadingProviders ? (
                  <FiLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FiRefreshCw className="h-3.5 w-3.5" />
                )}
                刷新
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {providers.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)]">
                      {p.label}
                      {p.isDefault && (
                        <span className="ml-1.5 text-[10px] text-[var(--accent)]">默认</span>
                      )}
                    </p>
                    <p className="text-[10px] text-[var(--text-caption)]">
                      {p.kind === "local" ? "本地" : "云端"}
                      {p.health.message ? ` · ${p.health.message}` : ""}
                    </p>
                  </div>
                  {p.health.ok ? (
                    <FiCheckCircle className="h-4 w-4 shrink-0 text-[var(--success)]" />
                  ) : (
                    <FiXCircle className="h-4 w-4 shrink-0 text-[var(--text-caption)]" />
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* 参数设置 */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">配音参数</h2>
            <p className="mt-0.5 text-xs text-[var(--text-caption)]">
              由 AI 导演下发任务时使用；手动合成与项目配音亦遵循此配置
            </p>
            <div className="mt-3 space-y-3">
              <label className="block text-xs text-[var(--text-caption)]">
                引擎
                <select
                  value={settings.provider ?? PROVIDER_AUTO}
                  onChange={(e) =>
                    updateSettings({
                      provider: (e.target.value || undefined) as VoiceCenterProviderId | undefined,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
                >
                  <option value={PROVIDER_AUTO}>自动（默认本地链）</option>
                  {providerOptions.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.health.ok}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-[var(--text-caption)]">
                质量
                <select
                  value={settings.quality}
                  onChange={(e) =>
                    updateSettings({ quality: e.target.value as VoiceQualityHint })
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
                >
                  <option value="standard">标准</option>
                  <option value="high">高质量</option>
                  <option value="ultra">超高质量</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={settings.ultraQuality}
                  onChange={(e) => updateSettings({ ultraQuality: e.target.checked })}
                />
                允许云端 ElevenLabs（超高质量回退）
              </label>
              <label className="block text-xs text-[var(--text-caption)]">
                语速 {settings.speed.toFixed(1)}×
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={settings.speed}
                  onChange={(e) => updateSettings({ speed: Number(e.target.value) })}
                  className="edit-range mt-1 w-full"
                />
              </label>
            </div>
          </section>
        </div>

        {/* 项目配音 */}
        <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">项目配音</h2>
              <p className="mt-0.5 text-xs text-[var(--text-caption)]">
                {projectTitle}
                {editGraph
                  ? ` · 配音轨 ${voiceStats.ready}/${voiceStats.total} 就绪`
                  : " · 尚未建立剪辑工程"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/canvas"
                className="btn-secondary flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs"
              >
                <FiExternalLink className="h-3.5 w-3.5" />
                无限画布
              </Link>
              <button
                type="button"
                disabled={projectLoading || !editGraph || voiceStats.total === 0}
                onClick={() => void runProjectVoice()}
                className="btn-primary flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs disabled:opacity-50"
              >
                {projectLoading ? (
                  <FiLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FiMic className="h-3.5 w-3.5" />
                )}
                生成项目全部配音
              </button>
            </div>
          </div>
          {!editGraph && (
            <p className="mt-3 text-xs text-[var(--text-caption)]">
              请先在「创作中心」运行编导，并在「无限画布」初始化剪辑时间线后再来生成配音。
            </p>
          )}
        </section>

        {/* 音色库 + 试听 */}
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">音色库</h2>
            <div className="mt-2 flex gap-2">
              <input
                value={voiceQuery}
                onChange={(e) => setVoiceQuery(e.target.value)}
                placeholder="搜索音色…"
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
              />
              <select
                value={voiceCategory}
                onChange={(e) => setVoiceCategory(e.target.value as VoiceCategory | "")}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm"
              >
                <option value="">全部分类</option>
                {(Object.entries(VOICE_CATEGORY_LABEL) as [VoiceCategory, string][]).map(
                  ([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {voices.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => updateSettings({ voiceId: v.id })}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      settings.voiceId === v.id
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] bg-[var(--bg-inset)] hover:border-[var(--accent)]/40"
                    }`}
                  >
                    <span className="font-medium text-[var(--text-primary)]">{v.label}</span>
                    <span className="ml-2 text-[var(--text-caption)]">
                      {VOICE_CATEGORY_LABEL[v.category]} · {v.provider}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-[var(--text-caption)]">
              当前音色：<span className="text-[var(--text-primary)]">{settings.voiceId}</span>
            </p>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">试听合成</h2>
            <textarea
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={previewLoading || !previewText.trim()}
              onClick={() => void runPreview()}
              className="btn-primary mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
            >
              {previewLoading ? (
                <FiLoader className="h-4 w-4 animate-spin" />
              ) : (
                <FiPlay className="h-4 w-4" />
              )}
              生成试听
            </button>
            {previewResult?.audio.url && (
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3">
                <p className="text-xs text-[var(--text-caption)]">
                  引擎 {previewResult.provider} · {previewResult.duration.toFixed(1)}s
                </p>
                <audio controls src={previewResult.audio.url} className="mt-2 w-full" />
              </div>
            )}
          </section>
        </div>

        {/* 日志 */}
        <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">最近日志</h2>
          {logs.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--text-caption)]">暂无合成记录</p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--border)]">
              {logs.map((log, i) => (
                <li key={`${log.taskId}-${i}`} className="flex items-center justify-between py-2 text-xs">
                  <span className="text-[var(--text-secondary)]">
                    {log.taskId} · {log.provider} · {log.durationMs}ms
                  </span>
                  <span
                    className={
                      log.status === "success" || log.status === "cached"
                        ? "text-[var(--success)]"
                        : "text-red-400"
                    }
                  >
                    {log.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
