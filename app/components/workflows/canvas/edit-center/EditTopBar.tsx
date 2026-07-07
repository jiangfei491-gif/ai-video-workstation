"use client";

import { FiFilm, FiPlay, FiAlertCircle } from "react-icons/fi";
import LoadingButton from "@/app/components/workflows/shared/LoadingButton";

type Props = {
  projectTitle: string;
  durationSec: number;
  shotCount: number;
  missingCount: number;
  editRendering: boolean;
  renderProgressPct: number;
  hasPlans: boolean;
  onRender: () => void;
  /** 左侧：布局切换等 */
  leading?: React.ReactNode;
};

export default function EditTopBar({
  projectTitle,
  durationSec,
  shotCount,
  missingCount,
  editRendering,
  renderProgressPct,
  hasPlans,
  onRender,
  leading,
}: Props) {
  const mins = Math.floor(durationSec / 60);
  const secs = Math.round(durationSec % 60);

  return (
    <header className="edit-topbar flex shrink-0 items-center gap-3 border-b border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2.5">
      {leading}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
          <FiFilm className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {projectTitle || "未命名项目"}
          </h1>
          <p className="text-xs text-[var(--text-caption)]">
            {mins > 0 ? `${mins} 分 ${secs} 秒` : `${secs} 秒`}
            <span className="mx-1.5 opacity-40">·</span>
            {shotCount} 镜
            {missingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[var(--danger)]">
                <FiAlertCircle className="h-3 w-3" />
                缺 {missingCount} 镜素材
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {editRendering && (
          <span className="hidden text-xs text-[var(--text-caption)] sm:inline">
            渲染中 {Math.round(renderProgressPct)}%
          </span>
        )}
        <LoadingButton
          variant="primary"
          loading={editRendering}
          loadingText={`渲染中 ${Math.round(renderProgressPct)}%`}
          disabled={!hasPlans && shotCount === 0}
          onClick={onRender}
          className="min-w-[120px] px-5"
        >
          <FiPlay className="h-4 w-4" />
          渲染成片
        </LoadingButton>
      </div>
    </header>
  );
}
