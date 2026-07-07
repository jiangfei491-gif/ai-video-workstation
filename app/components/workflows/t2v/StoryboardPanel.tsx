"use client";

import { useRef, useState } from "react";
import {
  FiArrowDown,
  FiArrowUp,
  FiEdit3,
  FiSliders,
  FiVideo,
  FiLoader,
  FiMove,
} from "react-icons/fi";
import PromptBuilder from "@/app/components/workflows/shared/PromptBuilder";
import CameraTrajectoryPanel from "@/app/components/workflows/shared/CameraTrajectoryPanel";
import type { BatchImageState } from "@/app/components/workflows/t2v/BatchImageGeneratePanel";
import StoryboardImageDashboard from "@/app/components/workflows/t2v/StoryboardImageDashboard";
import type { DirectorState } from "@/app/lib/workbench-persist/types";
import type { ProjectCostLedger } from "@/app/lib/cost-ledger/types";
import type { ShotTimelineEntry } from "@/app/lib/consistency-engine/types/world-style-camera";

type ImageFrame = {
  url: string;
  assetId: string;
  model?: string;
  source?: string;
};

type Props = {
  director: DirectorState;
  activeShotIdx: number;
  onSelectShot: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onUpdatePrompt: (index: number, providerPrompt: string) => void;
  /** 文生图模式：卡片流排版（分镜 + 提示词 + 图片） */
  imageMode?: boolean;
  shotImages?: Record<number, string>;
  shotImageMeta?: Record<number, { model: string; source: string; aspectRatio?: string }>;
  /** 项目默认画面比例，单镜未记录时使用 */
  defaultAspectRatio?: string;
  draftsByShot?: Record<number, ImageFrame[]>;
  imageLoadingShot?: number | null;
  imageBatchStatus?: Record<number, BatchImageState>;
  imageErr?: string | null;
  onGenerateImage?: (index: number) => void;
  onAdoptCandidate?: (index: number, frame: ImageFrame) => void;
  onPreviewImage?: (url: string) => void;
  batchRunning?: boolean;
  onRunBatch?: () => void;
  shotFavorites?: Record<number, boolean>;
  onToggleFavorite?: (index: number) => void;
  onRunBatchSelected?: (indices: number[], regenerate?: boolean) => void;
  onDeleteShots?: (indices: number[]) => void;
  onBatchFavorite?: (indices: number[]) => void;
  shotTimeline?: Record<number, ShotTimelineEntry>;
  projectCostLedger?: ProjectCostLedger | null;
};

export default function StoryboardPanel({
  director,
  activeShotIdx,
  onSelectShot,
  onReorder,
  onUpdatePrompt,
  imageMode,
  shotImages = {},
  shotImageMeta = {},
  defaultAspectRatio = "9:16",
  draftsByShot = {},
  imageLoadingShot = null,
  imageBatchStatus = {},
  imageErr,
  onGenerateImage,
  onAdoptCandidate,
  onPreviewImage,
  batchRunning,
  onRunBatch,
  shotFavorites = {},
  onToggleFavorite,
  onRunBatchSelected,
  onDeleteShots,
  onBatchFavorite,
  shotTimeline = {},
  projectCostLedger,
}: Props) {
  const { storyboard, prompts } = director;
  const [mode, setMode] = useState<"builder" | "raw">("raw");
  const [videoExtracting, setVideoExtracting] = useState(false);
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoInput = useRef<HTMLInputElement>(null);

  function appendDirective(directive: string) {
    const cur = (prompts[activeShotIdx]?.providerPrompt ?? "").trim().replace(/\.\s*$/, "");
    const next = [cur, directive].filter(Boolean).join(", ") + ".";
    setMode("raw");
    onUpdatePrompt(activeShotIdx, next);
  }

  function moveShot(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= prompts.length) return;
    onReorder(index, next);
  }

  async function handleVideo(file: File | undefined | null) {
    if (!file || !file.type.startsWith("video/")) return;
    setVideoErr(null);
    setVideoExtracting(true);
    try {
      const fd = new FormData();
      fd.append("video", file);
      const res = await fetch("/api/director/extract-prompt-from-video", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "视频反推失败");
      setMode("raw");
      onUpdatePrompt(activeShotIdx, data.prompt as string);
    } catch (e) {
      setVideoErr(e instanceof Error ? e.message : String(e));
    } finally {
      setVideoExtracting(false);
      if (videoInput.current) videoInput.current.value = "";
    }
  }

  if (imageMode) {
    return (
      <StoryboardImageDashboard
        director={director}
        activeShotIdx={activeShotIdx}
        onSelectShot={onSelectShot}
        onUpdatePrompt={onUpdatePrompt}
        shotImages={shotImages}
        shotImageMeta={shotImageMeta}
        shotFavorites={shotFavorites}
        defaultAspectRatio={defaultAspectRatio}
        imageLoadingShot={imageLoadingShot ?? null}
        imageBatchStatus={imageBatchStatus}
        batchRunning={!!batchRunning}
        onGenerateImage={(i) => onGenerateImage?.(i)}
        onPreviewImage={(url) => onPreviewImage?.(url)}
        onToggleFavorite={(i) => onToggleFavorite?.(i)}
        onRunBatch={() => onRunBatch?.()}
        onRunBatchSelected={(indices, regen) => onRunBatchSelected?.(indices, regen)}
        onDeleteShots={(indices) => onDeleteShots?.(indices)}
        onBatchFavorite={(indices) => onBatchFavorite?.(indices)}
        shotTimeline={shotTimeline}
        projectCostLedger={projectCostLedger}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {prompts.map((p, i) => (
          <button
            key={`${p.sceneNumber}-${i}`}
            type="button"
            onClick={() => onSelectShot(i)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              i === activeShotIdx ? "nav-item-active" : "btn-secondary"
            }`}
          >
            镜头 {i + 1}
          </button>
        ))}
      </div>

      {storyboard[activeShotIdx] && (
        <div className="rounded-lg border border-[var(--border)] p-4 text-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="workbench-label">分镜 #{activeShotIdx + 1}</p>
            <div className="flex gap-1">
              <button
                type="button"
                className="btn-secondary rounded p-1.5"
                disabled={activeShotIdx === 0}
                onClick={() => moveShot(activeShotIdx, -1)}
                title="上移"
              >
                <FiArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn-secondary rounded p-1.5"
                disabled={activeShotIdx >= prompts.length - 1}
                onClick={() => moveShot(activeShotIdx, 1)}
                title="下移"
              >
                <FiArrowDown className="h-4 w-4" />
              </button>
            </div>
          </div>
          <dl className="grid gap-2 text-[var(--text-secondary)]">
            <div>
              <dt className="text-xs text-[var(--text-caption)]">角色</dt>
              <dd>{storyboard[activeShotIdx].character || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-caption)]">动作</dt>
              <dd>{storyboard[activeShotIdx].action || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-caption)]">环境</dt>
              <dd>{storyboard[activeShotIdx].environment || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-caption)]">镜头</dt>
              <dd>{storyboard[activeShotIdx].camera || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-caption)]">旁白</dt>
              <dd>{storyboard[activeShotIdx].narration || "—"}</dd>
            </div>
          </dl>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="workbench-label">镜头描述（提示词）</label>
          <div className="flex gap-1 rounded-lg bg-[var(--bg-surface)] p-0.5">
            <button
              type="button"
              onClick={() => setMode("builder")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === "builder" ? "nav-item-active" : "text-[var(--text-secondary)]"
              }`}
            >
              <FiSliders className="h-3.5 w-3.5" />
              高级模式
            </button>
            <button
              type="button"
              onClick={() => setMode("raw")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === "raw" ? "nav-item-active" : "text-[var(--text-secondary)]"
              }`}
            >
              <FiEdit3 className="h-3.5 w-3.5" />
              修改提示词
            </button>
          </div>
        </div>

        <p className="mb-2 text-xs text-[var(--text-caption)]">
          提示：用 <span className="font-mono text-[var(--accent)]">@角色名</span> /{" "}
          <span className="font-mono text-[var(--accent)]">@场景名</span> 引用资源中心。
        </p>

        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={videoExtracting}
            onClick={() => videoInput.current?.click()}
            className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {videoExtracting ? (
              <FiLoader className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FiVideo className="h-3.5 w-3.5" />
            )}
            {videoExtracting ? "反推中…" : "上传参考视频 → 反推提示词"}
          </button>
          <button
            type="button"
            onClick={() => setShowCamera((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              showCamera ? "nav-item-active" : "btn-secondary"
            }`}
          >
            <FiMove className="h-3.5 w-3.5" />
            运镜轨迹
          </button>
          <input
            ref={videoInput}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleVideo(e.target.files?.[0])}
          />
        </div>
        {videoErr && (
          <p className="mb-2 text-xs font-medium text-[var(--danger)]">{videoErr}</p>
        )}

        {showCamera && (
          <div className="mb-3">
            <CameraTrajectoryPanel onApply={appendDirective} />
          </div>
        )}

        {mode === "builder" ? (
          <PromptBuilder onApply={(prompt) => onUpdatePrompt(activeShotIdx, prompt)} />
        ) : (
          <textarea
            className="input-field min-h-[120px] w-full rounded-lg px-3 py-2.5 text-sm leading-relaxed"
            value={prompts[activeShotIdx]?.providerPrompt ?? ""}
            onChange={(e) => onUpdatePrompt(activeShotIdx, e.target.value)}
          />
        )}

        {mode === "builder" && prompts[activeShotIdx]?.providerPrompt && (
          <div className="mt-3 rounded-lg border border-[var(--border)] p-3">
            <p className="mb-1 text-xs text-[var(--text-caption)]">当前镜头提示词</p>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              {prompts[activeShotIdx].providerPrompt}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
