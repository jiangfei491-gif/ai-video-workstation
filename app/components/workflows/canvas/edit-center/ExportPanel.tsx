"use client";

import Link from "next/link";
import { useState } from "react";
import { FiDownload, FiLoader } from "react-icons/fi";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import type { EditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";
import { UI_LANGUAGES } from "@/app/lib/auto-edit/engines/localization";

type Props = {
  state: T2VWorkbenchState;
  settings: EditEngineSettings;
  projectName: string;
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

export default function ExportPanel({ state, settings, projectName }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uiLang, setUiLang] = useState("zh");

  const exportBundle = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auto-edit/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workbench: state, settings }),
      });
      const data = (await res.json()) as {
        artifacts?: { kind: string; filename: string; content?: string; url?: string }[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "导出失败");

      for (const art of data.artifacts ?? []) {
        if (art.content) downloadText(art.filename, art.content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-primary)]">导出包</p>
        <p className="mt-1 text-[9px] text-[var(--text-caption)]">
          SRT / ASS / FCPXML{settings.export.includeSrt ? " · SRT" : ""}
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <Link
            href="/subtitle-center"
            className="btn-secondary flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs"
          >
            <FiDownload className="h-3 w-3" />
            字幕中心（SRT/ASS/VTT）
          </Link>
          <button
            type="button"
            disabled={loading}
            onClick={exportBundle}
            className="btn-secondary flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs disabled:opacity-50"
          >
            {loading ? <FiLoader className="h-3 w-3 animate-spin" /> : <FiDownload className="h-3 w-3" />}
            导出工程包
          </button>
        </div>
        {state.finalEditVideoUrl && (
          <a
            href={state.finalEditVideoUrl}
            download
            className="btn-primary mt-2 block rounded-lg px-3 py-2 text-center text-xs"
          >
            下载 MP4 成片
          </a>
        )}
        {error && <p className="mt-2 text-[10px] text-[var(--danger)]">{error}</p>}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-primary)]">多语言 (Phase 5)</p>
        <label className="mt-2 block text-[10px] text-[var(--text-caption)]">
          界面语言预览
          <select
            value={uiLang}
            onChange={(e) => setUiLang(e.target.value)}
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
          >
            {UI_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-[9px] text-[var(--text-caption)]">
          术语库与多语言配音在渲染配置中启用 localization
        </p>
      </section>
    </div>
  );
}
