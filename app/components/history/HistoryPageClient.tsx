"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/layout/AppShell";
import ConfirmDialog from "@/app/components/shared/ConfirmDialog";
import HistoryCard from "@/app/components/history/HistoryCard";
import LoadingButton from "@/app/components/workflows/shared/LoadingButton";
import {
  clearImageHistory,
  deleteImageHistory,
  getImageHistoryById,
  searchImageHistory,
  useImageHistory,
} from "@/app/lib/history/image-store";
import {
  clearVideoHistory,
  deleteVideoHistory,
  getVideoHistoryById,
  searchVideoHistory,
  useVideoHistory,
} from "@/app/lib/history/video-store";
import { patchUiState, useUiState } from "@/app/lib/ui-state/store";
import { restoreT2VFromHistory } from "@/app/lib/workbench-persist/t2v-store";
import { isExportSuccess, normalizeExportMeta } from "@/app/lib/export/types";
import { inferSeedMode, normalizeClarity } from "@/app/lib/generation-params";
import { normalizePipelineMode } from "@/app/lib/pipeline-mode";
import { blobToObjectUrl } from "@/app/lib/history/blob-store";
import type { HistoryTab } from "@/app/lib/ui-state/store";

type ConfirmState = {
  type: "delete-one" | "clear-video" | "clear-image" | "clear-all";
  id?: string;
};

export default function HistoryPageClient() {
  const router = useRouter();
  const { state: ui, patch: patchUi } = useUiState();
  const tab = ui.currentHistoryTab;
  const videoEntries = useVideoHistory();
  const imageEntries = useImageHistory();

  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const filteredVideo = searchVideoHistory({ q, dateFrom, dateTo });
  const filteredImage = searchImageHistory({ q, dateFrom, dateTo });

  function setTab(next: HistoryTab) {
    patchUi({ currentHistoryTab: next });
    patchUiState({ currentHistoryTab: next });
  }

  async function handleRestoreVideo(id: string) {
    const entry = getVideoHistoryById(id);
    if (!entry) return;
    const activeIdx = 0;
    const shot = entry.shots[activeIdx];
    let testUrl: string | null = shot?.veoPreviewUrl ?? null;
    let prodUrl: string | null = shot?.veoProductionUrl ?? null;
    if (shot?.veoPreviewBlobId) testUrl = await blobToObjectUrl(shot.veoPreviewBlobId);
    if (shot?.veoProductionBlobId) prodUrl = await blobToObjectUrl(shot.veoProductionBlobId);

    restoreT2VFromHistory({
      topic: entry.topic,
      shotCount: entry.shotParams.shotCount as 3 | 5 | 8 | 10,
      shotDurationSec: entry.shotParams.shotDurationSec as 3 | 5 | 8 | 10,
      fps: entry.shotParams.fps,
      aspectRatio: entry.shotParams.aspectRatio,
      clarity: normalizeClarity(entry.shotParams.clarity),
      pipelineMode: normalizePipelineMode(entry.shotParams.pipelineMode),
      workspaceMode: entry.shotParams.workspaceMode,
      characterConsistency: entry.shotParams.characterConsistency,
      sceneConsistency: entry.shotParams.sceneConsistency,
      seedMode: inferSeedMode(entry.shotParams.seedMode, entry.shotParams.seed),
      seed: entry.shotParams.seed,
      export: normalizeExportMeta(entry.export),
      director: entry.director,
      activeShotIdx: activeIdx,
      historyEntryId: entry.id,
      testResult: testUrl
        ? { taskId: entry.id, videoUrl: testUrl, seed: entry.shotParams.seed ?? 0 }
        : null,
      prodResult: prodUrl,
      veoStatus: prodUrl || testUrl ? "success" : "idle",
      veoSuccessMessage: prodUrl || testUrl ? "已从历史恢复" : null,
    });
    router.push("/ai-video");
  }

  async function handleRestoreImage(id: string) {
    const entry = getImageHistoryById(id);
    if (!entry) return;
    restoreT2VFromHistory({
      topic: entry.topic || entry.prompt,
      pipelineMode: "t2i",
      aspectRatio: entry.aspectRatio,
      clarity: normalizeClarity(entry.clarity),
      seedMode: inferSeedMode(entry.imageParams.seedMode, entry.imageParams.seed),
      seed: entry.imageParams.seed,
      export: normalizeExportMeta(entry.export),
      historyEntryId: entry.id,
    });
    router.push("/ai-video");
  }

  function deleteConfirmMessage(): string {
    if (confirm?.type !== "delete-one" || !confirm.id) {
      return "此操作不可恢复，确定继续吗？";
    }
    const entry =
      tab === "video"
        ? getVideoHistoryById(confirm.id)
        : getImageHistoryById(confirm.id);
    if (entry && isExportSuccess(entry.export)) {
      return "此项目已导出过。确认删除本地记录？";
    }
    return "此操作不可恢复，确定继续吗？";
  }

  async function onConfirmAction() {
    if (!confirm) return;
    if (confirm.type === "delete-one" && confirm.id) {
      if (tab === "video") await deleteVideoHistory(confirm.id);
      else await deleteImageHistory(confirm.id);
    } else if (confirm.type === "clear-video") {
      await clearVideoHistory();
    } else if (confirm.type === "clear-image") {
      await clearImageHistory();
    } else if (confirm.type === "clear-all") {
      await clearVideoHistory();
      await clearImageHistory();
    }
    setConfirm(null);
  }

  const list = tab === "video" ? filteredVideo : filteredImage;

  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h1 className="workbench-page-title">历史记录</h1>
          <div className="mt-3 flex gap-1 rounded-lg bg-[var(--bg-inset)] p-0.5">
            {(["video", "image"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                  tab === t
                    ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {t === "video" ? "创作中心历史" : "图片历史"}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex flex-wrap gap-3">
            <input
              className="input-field min-w-[200px] flex-1 rounded-lg px-3 py-2 text-sm"
              placeholder="搜索主题或提示词"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <input
              type="date"
              className="input-field rounded-lg px-3 py-2 text-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <input
              type="date"
              className="input-field rounded-lg px-3 py-2 text-sm"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {tab === "video" && videoEntries.length > 0 && (
              <LoadingButton
                variant="secondary"
                onClick={() => setConfirm({ type: "clear-video" })}
              >
                清空创作中心历史
              </LoadingButton>
            )}
            {tab === "image" && imageEntries.length > 0 && (
              <LoadingButton
                variant="secondary"
                onClick={() => setConfirm({ type: "clear-image" })}
              >
                清空图片历史
              </LoadingButton>
            )}
            {(videoEntries.length > 0 || imageEntries.length > 0) && (
              <LoadingButton
                variant="secondary"
                onClick={() => setConfirm({ type: "clear-all" })}
              >
                全部清空
              </LoadingButton>
            )}
          </div>

          {list.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">暂无历史记录</p>
          ) : (
            <ul className="space-y-3">
              {tab === "video"
                ? filteredVideo.map((e) => (
                    <HistoryCard
                      key={e.id}
                      entry={e}
                      type="video"
                      onRestore={() => handleRestoreVideo(e.id)}
                      onDelete={() => setConfirm({ type: "delete-one", id: e.id })}
                    />
                  ))
                : filteredImage.map((e) => (
                    <HistoryCard
                      key={e.id}
                      entry={e}
                      type="image"
                      onRestore={() => handleRestoreImage(e.id)}
                      onDelete={() => setConfirm({ type: "delete-one", id: e.id })}
                    />
                  ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.type === "clear-all"
            ? "确认全部清空"
            : confirm?.type?.startsWith("clear")
              ? "确认清空"
              : "确认删除"
        }
        message={deleteConfirmMessage()}
        confirmLabel={confirm?.type === "delete-one" ? "确认删除" : "确认清空"}
        onCancel={() => setConfirm(null)}
        onConfirm={onConfirmAction}
      />
    </AppShell>
  );
}
