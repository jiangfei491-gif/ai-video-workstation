"use client";

import { useEffect, useState } from "react";
import { FiMusic, FiFileText, FiBox, FiMic, FiFilm, FiImage, FiStar } from "react-icons/fi";

type LibraryItem = {
  id: string;
  libraryId: string;
  title: string;
  category?: string;
  tags?: string[];
  thumbnailUrl?: string;
  previewUrl?: string;
  fileUrl?: string;
  mimeType?: string;
  fileSize?: number;
  favorite?: boolean;
  rating?: number;
};

const AUDIO_LIBS = new Set(["music", "sfx", "voice"]);
const VIDEO_LIBS = new Set(["video", "effect"]);

function isAudio(it: LibraryItem): boolean {
  return (it.mimeType?.startsWith("audio") ?? false) || AUDIO_LIBS.has(it.libraryId);
}
function isVideo(it: LibraryItem): boolean {
  return (it.mimeType?.startsWith("video") ?? false) || VIDEO_LIBS.has(it.libraryId);
}
function humanSize(n?: number): string {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  image: FiImage,
  video: FiFilm,
  effect: FiFilm,
  music: FiMusic,
  sfx: FiMusic,
  voice: FiMic,
  subtitle: FiFileText,
  prompt: FiFileText,
  dataset: FiFileText,
  lora: FiBox,
  character: FiBox,
  brand: FiBox,
};

export default function LibraryContent({ libraryId }: { libraryId: string }) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/resource-center/${libraryId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setItems((d.items ?? []) as LibraryItem[]);
        setTotal(d.total ?? (d.items?.length ?? 0));
      })
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [libraryId]);

  const Icon = TYPE_ICON[libraryId] ?? FiBox;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">库内容</h3>
        <span className="text-xs text-[var(--text-caption)]">
          共 {total} 项{total > items.length ? `，显示前 ${items.length}` : ""}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-caption)]">加载中…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center text-sm text-[var(--text-caption)]">
          该库暂无内容。去「抓取」tab 抓取该类型素材后会自动入库。
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <ItemCard key={it.id} item={it} Icon={Icon} />
          ))}
        </div>
      )}
    </section>
  );
}

function ItemCard({ item: it, Icon }: { item: LibraryItem; Icon: React.ComponentType<{ className?: string }> }) {
  const img = it.thumbnailUrl || it.previewUrl;
  const audio = isAudio(it);
  const video = isVideo(it);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
      {/* 预览区 */}
      {audio ? (
        <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-[var(--bg-inset)] p-3">
          <Icon className="h-8 w-8 text-[var(--text-caption)]" />
          {it.fileUrl ? (
            <audio controls preload="none" src={it.fileUrl} className="w-full" />
          ) : (
            <span className="text-[11px] text-[var(--text-caption)]">无音频文件</span>
          )}
        </div>
      ) : (
        <a
          href={it.fileUrl || it.previewUrl || it.thumbnailUrl || undefined}
          target="_blank"
          rel="noreferrer"
          className="group relative flex aspect-square items-center justify-center overflow-hidden bg-[var(--bg-inset)]"
        >
          {video && it.fileUrl && !img ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={it.fileUrl} className="h-full w-full object-cover" muted preload="metadata" />
          ) : img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={it.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
          ) : (
            <Icon className="h-8 w-8 text-[var(--text-caption)]" />
          )}
          {video && <span className="absolute inset-0 flex items-center justify-center text-white/90"><span className="rounded-full bg-black/40 px-2 py-1 text-xs">▶ 视频</span></span>}
          {it.favorite && <FiStar className="absolute right-1.5 top-1.5 h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
        </a>
      )}

      {/* 信息区 */}
      <div className="p-2">
        <p className="truncate text-xs font-medium text-[var(--text-primary)]" title={it.title}>{it.title}</p>
        <div className="mt-0.5 flex items-center justify-between gap-1">
          <span className="flex min-w-0 items-center gap-1.5">
            {it.category && <span className="truncate text-[11px] text-[var(--text-caption)]">{it.category}</span>}
            {typeof it.rating === "number" && it.rating > 0 && (
              <span className="shrink-0 text-[11px] font-medium text-amber-500">★{it.rating}</span>
            )}
          </span>
          {it.fileUrl && (
            <a href={it.fileUrl} download className="shrink-0 text-[11px] text-[var(--accent)] hover:underline">下载{it.fileSize ? `·${humanSize(it.fileSize)}` : ""}</a>
          )}
        </div>
        {it.tags && it.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {it.tags.slice(0, 3).map((t, i) => (
              <span key={i} className="rounded bg-[var(--bg-inset)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
