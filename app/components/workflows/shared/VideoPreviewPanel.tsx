"use client";

import type { VeoJobStatus } from "@/app/lib/workbench-persist/types";
import { FiLoader, FiVideo } from "react-icons/fi";

type Props = {
  status: VeoJobStatus;
  videoUrl: string | null;
  error?: string | null;
};

const PLACEHOLDER_MIN_H = "min-h-[280px]";

export default function VideoPreviewPanel({ status, videoUrl, error }: Props) {
  return (
    <div
      className={`mt-4 flex ${PLACEHOLDER_MIN_H} flex-col overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bg-inset)]`}
    >
      <div className="shrink-0 border-b border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]">
        视频预览
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {status === "success" && videoUrl ? (
          <video src={videoUrl} controls className="max-h-64 w-full rounded-lg bg-black" />
        ) : status === "generating" ? (
          <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-soft)]">
              <FiLoader className="h-7 w-7 animate-spin text-[var(--accent)]" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">生成中…</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
              <div className="h-full w-2/3 animate-shimmer rounded-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-70" />
            </div>
            <p className="text-xs font-medium text-[var(--text-secondary)]">
              预计 30~90 秒，请稍候
            </p>
          </div>
        ) : status === "failed" ? (
          <div className="max-w-md text-center">
            <p className="text-sm font-semibold text-[var(--danger)]">视频生成失败</p>
            {error && (
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                错误信息：{error}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center">
            <FiVideo className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">尚未生成视频</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">点击「预览」开始生成视频</p>
          </div>
        )}
      </div>
    </div>
  );
}
