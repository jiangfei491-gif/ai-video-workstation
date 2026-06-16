"use client";

import { useEffect, useState } from "react";
import { blobToObjectUrl } from "@/app/lib/history/blob-store";
import { isExportSuccess } from "@/app/lib/export/types";
import type { ImageHistoryEntry, VideoHistoryEntry } from "@/app/lib/history/types";
import LoadingButton from "@/app/components/workflows/shared/LoadingButton";

type Props = {
  entry: VideoHistoryEntry | ImageHistoryEntry;
  type: "video" | "image";
  onRestore: () => void;
  onDelete: () => void;
};

export default function HistoryCard({ entry, type, onRestore, onDelete }: Props) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    blobToObjectUrl(entry.thumbnailBlobId).then((u) => {
      if (u) {
        url = u;
        setThumbUrl(u);
      }
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [entry.thumbnailBlobId]);

  const topic = entry.topic || "未命名";
  const exported = isExportSuccess(entry.export);

  return (
    <li className="flex gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--bg-inset)]">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-[var(--text-muted)]">无缩略图</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{topic}</p>
          <span
            className={`shrink-0 text-xs font-medium ${
              exported ? "text-[var(--success)]" : "text-[var(--text-muted)]"
            }`}
          >
            {exported ? "✓ 已导出" : "● 未导出"}
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--text-caption)]">
          {new Date(entry.createdAt).toLocaleString()}
          {type === "video" && "status" in entry && (
            <span className="ml-2">
              · {(entry as VideoHistoryEntry).status === "completed" ? "已完成" : (entry as VideoHistoryEntry).status === "running" ? "进行中" : "失败"}
            </span>
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <LoadingButton className="!px-3 !py-1.5 !text-xs" onClick={onRestore}>
            恢复
          </LoadingButton>
          <LoadingButton
            variant="secondary"
            className="!px-3 !py-1.5 !text-xs !text-[var(--danger)]"
            onClick={onDelete}
          >
            删除
          </LoadingButton>
        </div>
      </div>
    </li>
  );
}
