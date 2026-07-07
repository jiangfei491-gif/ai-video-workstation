"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import type { OpenCutStatus } from "@/app/api/opencut/status/route";
import WorkbenchPipelineNav from "./WorkbenchPipelineNav";

const CanvasEditShell = dynamic(
  () => import("@/app/components/workflows/canvas/CanvasEditShell"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-[var(--text-caption)]">
        正在加载剪辑台…
      </div>
    ),
  }
);

const OpenCutEditorEmbed = dynamic(() => import("./OpenCutEditorEmbed"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-[var(--text-caption)]">
      正在加载 OpenCut 剪辑台…
    </div>
  ),
});

type Mode = "checking" | "opencut" | "nle";

export default function EditAdvancedShell() {
  const [mode, setMode] = useState<Mode>("checking");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/opencut/status", { cache: "no-store" });
        const data = (await res.json()) as OpenCutStatus;
        if (active) setMode(data.ready ? "opencut" : "nle");
      } catch {
        if (active) setMode("nle");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const subtitle =
    mode === "opencut"
      ? "内嵌 OpenCut · 时间线 · 多轨 · 转场 · 字幕 · 导出"
      : "中文剪辑台 · 时间线 · 多轨 · 转场 · 字幕 · 导出";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <WorkbenchPipelineNav />
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
        <Link href="/ai-edit" className="edit-icon-btn" title="返回 AI 剪辑">
          <FiArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">高级编辑</p>
          <p className="text-[10px] text-[var(--text-caption)]">{subtitle}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {mode === "checking" ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-caption)]">
            正在加载剪辑台…
          </div>
        ) : mode === "opencut" ? (
          <OpenCutEditorEmbed />
        ) : (
          <CanvasEditShell advancedOnly />
        )}
      </div>
    </div>
  );
}
