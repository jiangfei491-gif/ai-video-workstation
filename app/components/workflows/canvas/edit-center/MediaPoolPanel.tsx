"use client";

import { useMemo, useState } from "react";
import type { MediaPoolItem, MediaPoolKind } from "@/app/lib/auto-edit/edit-graph/types";

const TABS: { id: MediaPoolKind | "all"; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "image", label: "图片" },
  { id: "video", label: "视频" },
  { id: "voice", label: "配音" },
  { id: "subtitle-text", label: "字幕" },
];

type Props = {
  items: MediaPoolItem[];
  activeShotIndex: number | null;
  onSelectItem: (item: MediaPoolItem) => void;
  /** 嵌入工作流步骤时使用紧凑布局 */
  compact?: boolean;
};

export default function MediaPoolPanel({ items, activeShotIndex, onSelectItem, compact }: Props) {
  const [tab, setTab] = useState<MediaPoolKind | "all">("all");

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((i) => i.kind === tab);
  }, [items, tab]);

  const readyCount = items.filter((i) => i.status === "ready").length;
  const missingCount = items.filter((i) => i.status === "missing").length;

  return (
    <div className={`flex h-full min-h-0 flex-col ${compact ? "max-h-48" : ""}`}>
      {!compact && (
      <div className="shrink-0 border-b border-[var(--border)] px-3 py-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">素材池</p>
        <p className="text-xs text-[var(--text-caption)]">
          就绪 {readyCount}
          {missingCount > 0 && (
            <span className="ml-1 text-[var(--danger)]">· 缺 {missingCount}</span>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`option-chip px-2 py-0.5 text-xs ${
                tab === t.id ? "option-chip-active" : ""
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      )}
      {compact && (
        <div className="shrink-0 border-b border-[var(--border)] px-2 py-1.5">
          {(tab === "voice" || tab === "subtitle-text") && (
            <p className="mb-1.5 text-[10px] leading-snug text-[var(--text-caption)]">
              {tab === "voice"
                ? "仅预览口播文本 · 生成请前往侧边栏「配音中心」"
                : "字幕已随分镜生成 · 导出请前往侧边栏「字幕中心」"}
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded px-1.5 py-0.5 text-xs ${
                  tab === t.id
                    ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                    : "text-[var(--text-caption)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={`min-h-0 flex-1 overflow-y-auto ${compact ? "p-1.5" : "p-2"}`}>
        <ul className="space-y-1.5">
          {filtered.map((item) => {
            const active = item.shotIndex !== undefined && item.shotIndex === activeShotIndex;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className={`flex w-full items-start gap-2 rounded-lg border p-2 text-left text-xs ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--bg-inset)] hover:border-[var(--accent)]/40"
                  }`}
                >
                  {item.url && item.kind !== "voice" && item.kind !== "subtitle-text" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt=""
                      className={`shrink-0 rounded object-cover ${compact ? "h-8 w-11" : "h-10 w-14"}`}
                    />
                  ) : (
                    <div className={`flex shrink-0 items-center justify-center rounded bg-black/20 text-xs text-[var(--text-caption)] ${compact ? "h-8 w-11" : "h-10 w-14"}`}>
                      {item.kind === "voice" ? "🎙" : item.kind === "subtitle-text" ? "字" : "—"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--text-primary)]">{item.label}</p>
                    {!compact && item.text && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-caption)]">
                        {item.text}
                      </p>
                    )}
                    <p
                      className={`mt-0.5 text-xs ${
                        item.status === "missing"
                          ? "text-[var(--danger)]"
                          : item.status === "pending"
                            ? "text-[var(--text-caption)]"
                            : "text-[var(--success)]"
                      }`}
                    >
                      {item.status === "missing"
                        ? "缺素材"
                        : item.status === "pending"
                          ? "待生成"
                          : "就绪"}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 && (
          <p className="py-4 text-center text-xs text-[var(--text-caption)]">暂无此类素材</p>
        )}
      </div>
    </div>
  );
}
