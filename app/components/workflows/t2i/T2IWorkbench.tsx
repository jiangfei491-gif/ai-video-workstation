"use client";

import { useState } from "react";
import ExportPanel from "@/app/components/workflows/shared/ExportPanel";
import LoadingButton from "@/app/components/workflows/shared/LoadingButton";
import SeedModeControls from "@/app/components/workflows/shared/SeedModeControls";
import WorkbenchSection from "@/app/components/workflows/shared/WorkbenchSection";
import WorkspaceModeToggle from "@/app/components/workflows/shared/WorkspaceModeToggle";
import { appendImageHistory } from "@/app/lib/history/image-store";
import { urlToBlobId } from "@/app/lib/history/blob-store";
import type { ImageHistoryEntry } from "@/app/lib/history/types";
import { exportT2IImagesPack, exportT2IProject } from "@/app/lib/export/executors";
import { createDefaultExportMeta, isExportSuccess } from "@/app/lib/export/types";
import { runWorkbenchExport, resetExportMeta } from "@/app/lib/export/run-export";
import { patchImageHistoryExport } from "@/app/lib/history/image-store";
import {
  randomGenerationSeed,
  resolveHistorySeed,
  resolveRequestSeed,
} from "@/app/lib/generation-params";
import {
  IMAGE_ASPECT_OPTIONS,
  IMAGE_CLARITY_OPTIONS,
  IMAGE_COUNT_OPTIONS,
  IMAGE_STYLE_OPTIONS,
} from "@/app/lib/image-gen/types";
import {
  getT2IState,
  useT2IWorkbenchStore,
} from "@/app/lib/workbench-persist/t2i-store";
import type { WorkspaceMode } from "@/app/lib/workspace-mode";

export default function T2IWorkbench() {
  const { state, patch } = useT2IWorkbenchStore();
  const [confirmDeleteExport, setConfirmDeleteExport] = useState(false);

  async function generateImages() {
    if (!state.topic.trim() && !state.prompt.trim()) {
      patch({ error: "请填写主题或提示词" });
      return;
    }
    patch({ loading: true, error: null });
    try {
      const res = await fetch("/api/openai/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: state.topic,
          prompt: state.prompt,
          style: state.style,
          aspectRatio: state.aspectRatio,
          clarity: state.clarity,
          n: state.imageCount,
          workspaceMode: state.workspaceMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生图失败");

      const images = (data.images as Array<{
        id: string;
        prompt: string;
        previewUrl: string;
        publicUrl: string;
        width: number;
        height: number;
        model: string;
        createdAt: string;
      }>).map((img) => ({ ...img, previewUrl: img.previewUrl ?? img.publicUrl }));

      patch({
        images,
        selectedImageId: images[0]?.id ?? null,
        prompt: data.prompt ?? state.prompt,
      });

      const usedSeed =
        state.seedMode === "fixed"
          ? resolveRequestSeed(state.seedMode, state.seed)!
          : randomGenerationSeed();

      const entryId = crypto.randomUUID();
      const imageItems = await Promise.all(
        images.map(async (img) => {
          const blobId = (await urlToBlobId(img.previewUrl, "t2i")) ?? `img-${img.id}`;
          return {
            id: img.id,
            blobId,
            publicUrl: img.publicUrl.startsWith("/api/") ? img.publicUrl : undefined,
            width: img.width,
            height: img.height,
          };
        })
      );
      const thumbBlobId = imageItems[0]?.blobId ?? entryId;

      const historyEntry: ImageHistoryEntry = {
        id: entryId,
        createdAt: new Date().toISOString(),
        topic: state.topic,
        prompt: data.prompt ?? state.prompt,
        style: state.style,
        aspectRatio: state.aspectRatio,
        clarity: state.clarity,
        imageParams: {
          width: images[0]?.width ?? 1024,
          height: images[0]?.height ?? 1024,
          imageCount: state.imageCount,
          seedMode: state.seedMode,
          seed: resolveHistorySeed(state.seedMode, state.seed, usedSeed),
        },
        thumbnailBlobId: thumbBlobId,
        export: createDefaultExportMeta(),
        images: imageItems,
      };
      appendImageHistory(historyEntry);
      patch({ historyEntryId: entryId, export: createDefaultExportMeta() });
    } catch (e) {
      patch({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      patch({ loading: false });
    }
  }

  async function handleExportProject() {
    if (!state.topic.trim() && !state.prompt.trim()) {
      patch({
        export: {
          ...state.export,
          exportStatus: "failed",
          exportError: "请先填写主题或提示词",
          lastExportType: "project",
        },
      });
      return;
    }
    try {
      const fileName = `project_${(state.topic || "image").replace(/\s+/g, "_")}.zip`;
      const meta = await runWorkbenchExport({
        exportType: "project",
        fileName,
        getExport: () => getT2IState().export,
        patchExport: (m) => patch({ export: m }),
        execute: async (onProgress) => {
          await exportT2IProject(getT2IState(), onProgress);
        },
      });
      if (state.historyEntryId) patchImageHistoryExport(state.historyEntryId, meta);
    } catch {
      /* failed state patched */
    }
  }

  async function handleExportImagesPack() {
    if (!state.images.length) {
      patch({
        export: {
          ...state.export,
          exportStatus: "failed",
          exportError: "没有可导出的图片",
          lastExportType: "images",
        },
      });
      return;
    }
    try {
      const fileName = `images_${(state.topic || "image").replace(/\s+/g, "_")}.zip`;
      const meta = await runWorkbenchExport({
        exportType: "images",
        fileName,
        getExport: () => getT2IState().export,
        patchExport: (m) => patch({ export: m }),
        execute: async (onProgress) => {
          await exportT2IImagesPack(getT2IState(), onProgress);
        },
      });
      if (state.historyEntryId) patchImageHistoryExport(state.historyEntryId, meta);
    } catch {
      /* failed state patched */
    }
  }

  function deleteExportRecord() {
    const cleared = resetExportMeta();
    patch({ export: cleared });
    if (state.historyEntryId) patchImageHistoryExport(state.historyEntryId, cleared);
    setConfirmDeleteExport(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
        <h1 className="workbench-page-title">动态图片</h1>
        <p className="workbench-page-desc mt-1">文生图 · 主题 → 提示词 → 风格 → 生成 → 导出</p>
        <div className="mt-3">
          <WorkspaceModeToggle
            mode={state.workspaceMode}
            onChange={(m: WorkspaceMode) => patch({ workspaceMode: m })}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <WorkbenchSection title="主题">
          <input
            className="input-field w-full rounded-lg px-3 py-2.5 text-sm"
            value={state.topic}
            onChange={(e) => patch({ topic: e.target.value })}
            placeholder="输入图片主题"
          />
        </WorkbenchSection>

        <WorkbenchSection title="提示词">
          <textarea
            className="input-field min-h-[100px] w-full rounded-lg px-3 py-2.5 text-sm"
            value={state.prompt}
            onChange={(e) => patch({ prompt: e.target.value })}
            placeholder="详细描述画面内容，留空则使用主题"
          />
        </WorkbenchSection>

        <WorkbenchSection title="风格">
          <div className="flex flex-wrap gap-2">
            {IMAGE_STYLE_OPTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => patch({ style: s.id })}
                className={`option-chip ${state.style === s.id ? "option-chip-active" : ""}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </WorkbenchSection>

        <WorkbenchSection title="生成图片">
          <LoadingButton
            loading={state.loading}
            loadingText="生成中…"
            disabled={state.loading}
            onClick={generateImages}
          >
            生成图片
          </LoadingButton>
        </WorkbenchSection>

        {state.images.length > 0 && (
          <WorkbenchSection title="图片预览">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {state.images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => patch({ selectedImageId: img.id })}
                  className={`overflow-hidden rounded-lg border-2 ${
                    state.selectedImageId === img.id
                      ? "border-[var(--accent)]"
                      : "border-[var(--border)]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.previewUrl} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          </WorkbenchSection>
        )}

        <WorkbenchSection title="配音">
          <textarea
            className="input-field min-h-[80px] w-full rounded-lg px-3 py-2.5 text-sm"
            value={state.voiceoverText}
            onChange={(e) => patch({ voiceoverText: e.target.value })}
            placeholder="配音文案（可与图片搭配使用）"
          />
        </WorkbenchSection>

        <WorkbenchSection title="字幕">
          <textarea
            className="input-field min-h-[80px] w-full rounded-lg px-3 py-2.5 text-sm"
            value={state.subtitleText}
            onChange={(e) => patch({ subtitleText: e.target.value })}
            placeholder="字幕内容"
          />
        </WorkbenchSection>

        <WorkbenchSection title="图片设置">
          <div className="space-y-4">
            <div>
              <p className="workbench-label mb-2">比例</p>
              <div className="flex flex-wrap gap-2">
                {IMAGE_ASPECT_OPTIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => patch({ aspectRatio: a.id })}
                    className={`option-chip ${state.aspectRatio === a.id ? "option-chip-active" : ""}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="workbench-label mb-2">清晰度</p>
              <div className="flex flex-wrap gap-2">
                {IMAGE_CLARITY_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => patch({ clarity: c.id })}
                    className={`option-chip ${state.clarity === c.id ? "option-chip-active" : ""}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="workbench-label mb-2">图片数量</p>
              <div className="flex flex-wrap gap-2">
                {IMAGE_COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => patch({ imageCount: n })}
                    className={`option-chip ${state.imageCount === n ? "option-chip-active" : ""}`}
                  >
                    {n} 张
                  </button>
                ))}
              </div>
            </div>
            <SeedModeControls
              seedMode={state.seedMode}
              seed={state.seed}
              onChange={(p) => patch(p)}
            />
          </div>
        </WorkbenchSection>

        <ExportPanel
          workbench="t2i"
          exportMeta={state.export}
          canExportProject={!!(state.topic.trim() || state.prompt.trim())}
          canExportMedia={state.images.length > 0}
          onExportProject={handleExportProject}
          onExportMedia={handleExportImagesPack}
          onDeleteRecord={() => setConfirmDeleteExport(true)}
        />

        {confirmDeleteExport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="rounded-xl bg-[var(--bg-surface)] p-6 shadow-xl">
              <p className="text-sm text-[var(--text-primary)]">
                {isExportSuccess(state.export)
                  ? "此项目已导出过。确认删除本地记录？"
                  : "确认删除导出记录？"}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn-secondary rounded-lg px-3 py-1.5 text-sm" onClick={() => setConfirmDeleteExport(false)}>取消</button>
                <button
                  type="button"
                  className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-sm text-white"
                  onClick={deleteExportRecord}
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}

        {state.error && (
          <p className="mt-4 text-sm font-medium text-[var(--danger)]">{state.error}</p>
        )}
      </div>
    </div>
  );
}
