"use client";

import type { ReactNode } from "react";
import { FiExternalLink, FiRefreshCw } from "react-icons/fi";
import type { MediaPoolItem, TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";
import MediaPoolPanel from "./MediaPoolPanel";
import type { EditLibraryTab } from "./EditLibraryPanel";

type Props = {
  tab: EditLibraryTab;
  mediaPool: MediaPoolItem[];
  activeShotIndex: number | null;
  onSelectMedia: (item: MediaPoolItem) => void;
  onSyncAssets?: () => void;
  bgmUrl?: string | null;
  subtitleClips: TimelineClip[];
  videoClips: TimelineClip[];
  shotFrames: Record<number, string | null | undefined>;
  batchResults: Record<number, { firstFrameUrl?: string | null } | undefined>;
  onOpenCanvas?: () => void;
  onFocusShot?: (shotIndex: number) => void;
  aiPanel: ReactNode;
  scriptPanel?: ReactNode;
};

export default function EditLibraryContent({
  tab,
  mediaPool,
  activeShotIndex,
  onSelectMedia,
  onSyncAssets,
  bgmUrl,
  subtitleClips,
  videoClips,
  shotFrames,
  batchResults,
  onOpenCanvas,
  onFocusShot,
  aiPanel,
  scriptPanel,
}: Props) {
  if (tab === "media") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {onSyncAssets && (
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <p className="text-xs font-medium text-[var(--text-secondary)]">项目素材</p>
            <button type="button" onClick={onSyncAssets} className="edit-icon-btn" title="同步画布素材">
              <FiRefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1">
          <MediaPoolPanel
            items={mediaPool}
            activeShotIndex={activeShotIndex}
            onSelectItem={onSelectMedia}
          />
        </div>
      </div>
    );
  }

  if (tab === "audio") {
    const audioItems = mediaPool.filter((i) => i.kind === "voice" || i.kind === "video");
    return (
      <div className="flex h-full min-h-0 flex-col overflow-auto p-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">音频</p>
        <p className="mt-0.5 text-xs text-[var(--text-caption)]">
          配音与 BGM 在时间轴「配音 / 音乐」轨编辑；生成请切到 AI 标签。
        </p>
        {bgmUrl && (
          <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2">
            <p className="text-xs font-medium text-[var(--text-primary)]">背景音乐</p>
            <p className="mt-0.5 truncate text-[10px] text-[var(--text-caption)]">{bgmUrl}</p>
          </div>
        )}
        <div className="mt-3 space-y-1.5">
          {audioItems.length === 0 ? (
            <p className="text-xs text-[var(--text-caption)]">暂无音频素材</p>
          ) : (
            audioItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectMedia(item)}
                className={`w-full rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                  item.shotIndex === activeShotIndex
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] hover:bg-[var(--bg-inset)]"
                }`}
              >
                <span className="font-medium text-[var(--text-primary)]">{item.label}</span>
                <span className="ml-1.5 text-[var(--text-caption)]">{item.kind === "voice" ? "配音" : "视频"}</span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  if (tab === "subtitle") {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-auto p-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">字幕</p>
        <p className="mt-0.5 text-xs text-[var(--text-caption)]">
          字幕轨与时间轴同步；生成与导出请前往侧边栏「字幕中心」。
        </p>
        <div className="mt-3 space-y-1.5">
          {subtitleClips.length === 0 ? (
            <p className="text-xs text-[var(--text-caption)]">暂无字幕片段</p>
          ) : (
            subtitleClips.map((clip) => (
              <div
                key={clip.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2.5 py-2"
              >
                <p className="text-[10px] text-[var(--text-caption)]">
                  {clip.startSec.toFixed(1)}s · {clip.durationSec.toFixed(1)}s
                </p>
                <p className="mt-0.5 text-xs leading-snug text-[var(--text-primary)]">
                  {clip.subtitle?.text ?? clip.label}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (tab === "ai") {
    return <div className="flex h-full min-h-0 flex-col overflow-hidden">{aiPanel}</div>;
  }

  if (tab === "script" && scriptPanel) {
    return <div className="flex h-full min-h-0 flex-col overflow-hidden">{scriptPanel}</div>;
  }

  if (tab === "storyboard") {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-auto p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">分镜</p>
            <p className="mt-0.5 text-xs text-[var(--text-caption)]">{videoClips.length} 镜</p>
          </div>
          {onOpenCanvas && (
            <button
              type="button"
              onClick={onOpenCanvas}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-inset)] px-2 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent)]"
            >
              <FiExternalLink className="h-3 w-3" />
              画布
            </button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {videoClips.map((clip) => {
            const idx = clip.video?.shotIndex;
            const thumb =
              idx !== undefined
                ? batchResults[idx]?.firstFrameUrl ?? shotFrames[idx] ?? null
                : null;
            const active = idx === activeShotIndex;
            return (
              <button
                key={clip.id}
                type="button"
                onClick={() => {
                  if (idx !== undefined) onFocusShot?.(idx);
                }}
                className={`overflow-hidden rounded-lg border text-left transition-colors ${
                  active ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--border)]"
                }`}
              >
                <div className="aspect-video bg-[var(--bg-inset)]">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-[var(--text-caption)]">
                      无预览
                    </div>
                  )}
                </div>
                <p className="truncate px-1.5 py-1 text-[10px] font-medium text-[var(--text-primary)]">
                  {clip.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
