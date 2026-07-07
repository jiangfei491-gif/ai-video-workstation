"use client";

import { useCallback, useEffect, useRef } from "react";
import { FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";

export type ImageGalleryItem = {
  url: string;
  title?: string;
  caption?: string;
  alt?: string;
};

type Props = {
  items: ImageGalleryItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

const SWIPE_THRESHOLD = 48;

export function findGalleryIndex(items: ImageGalleryItem[], url: string): number {
  const idx = items.findIndex((it) => it.url === url);
  return idx >= 0 ? idx : 0;
}

export function shotImageGalleryItems(
  shotCount: number,
  shotImages: Record<number, string | undefined>,
  label?: (i: number) => string
): ImageGalleryItem[] {
  const out: ImageGalleryItem[] = [];
  for (let i = 0; i < shotCount; i++) {
    const url = shotImages[i];
    if (url) {
      out.push({ url, title: label?.(i) ?? `镜头 ${i + 1}` });
    }
  }
  return out;
}

export function refImageGalleryItems<T extends { refImageUrl: string | null; name: string }>(
  entities: T[],
  detail: (e: T) => string,
  titlePrefix = "@"
): ImageGalleryItem[] {
  return entities
    .filter((e) => e.refImageUrl)
    .map((e) => ({
      url: e.refImageUrl!,
      title: `${titlePrefix}${e.name}`,
      caption: detail(e),
    }));
}

export default function ImageGalleryLightbox({
  items,
  index,
  onClose,
  onIndexChange,
}: Props) {
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const current = items[index];
  const hasNav = items.length > 1;

  const goPrev = useCallback(() => {
    if (!hasNav) return;
    onIndexChange((index - 1 + items.length) % items.length);
  }, [hasNav, index, items.length, onIndexChange]);

  const goNext = useCallback(() => {
    if (!hasNav) return;
    onIndexChange((index + 1) % items.length);
  }, [hasNav, index, items.length, onIndexChange]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  if (!current) return null;

  const useCard = !!(current.title || current.caption);

  function onTouchStart(e: React.TouchEvent) {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!touchRef.current || !hasNav) {
      touchRef.current = null;
      return;
    }
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchRef.current = null;
  }

  function onWheel(e: React.WheelEvent) {
    if (!hasNav) return;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 12) return;
    e.preventDefault();
    if (e.deltaX > 0) goNext();
    else goPrev();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-6"
      onClick={onClose}
    >
      {hasNav && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-3 top-1/2 z-[60] -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70 sm:left-5"
            title="上一张（←）"
            aria-label="上一张"
          >
            <FiChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-3 top-1/2 z-[60] -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70 sm:right-5"
            title="下一张（→）"
            aria-label="下一张"
          >
            <FiChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 z-[60] rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
        title="关闭（Esc）"
        aria-label="关闭"
      >
        <FiX className="h-5 w-5" />
      </button>

      {hasNav && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[60] -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
          {index + 1} / {items.length}
        </div>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
        className={
          useCard
            ? "flex max-h-full max-w-4xl flex-col overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-2xl"
            : "flex max-h-full max-w-[min(100%,72rem)] flex-col items-center"
        }
      >
        {current.title && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5">
            <span className="font-mono text-sm font-semibold text-[var(--accent)]">{current.title}</span>
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.alt ?? current.title ?? "预览"}
          className={
            useCard
              ? "min-h-0 w-full flex-1 object-contain"
              : "max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
          }
          draggable={false}
        />
        {current.caption && (
          <p className="shrink-0 border-t border-[var(--border)] px-4 py-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
            {current.caption}
          </p>
        )}
      </div>
    </div>
  );
}
