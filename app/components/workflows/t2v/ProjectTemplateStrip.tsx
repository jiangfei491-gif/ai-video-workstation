"use client";

import { useCallback, useEffect, useState } from "react";
import { FiUser, FiMapPin, FiX } from "react-icons/fi";

type Item = { id: string; name: string; refImageUrl: string | null; detail: string };

type Props = {
  title: string;
  /** 本项目已导入的 id */
  ids: string[];
  apiPath: string;
  /** 返回 JSON 里的数组字段名，如 characters / scenes */
  listKey: string;
  /** 描述字段名，如 appearance / description */
  detailKey: string;
  icon: "user" | "scene";
};

/** 右栏顶部的模板预览窗：横向展示本项目用到的角色/场景图，点击看大图 */
export default function ProjectTemplateStrip({ title, ids, apiPath, listKey, detailKey, icon }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [preview, setPreview] = useState<Item | null>(null);
  const idsKey = ids.join(",");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(apiPath);
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) return;
      const raw = (data[listKey] as Array<Record<string, unknown>>) ?? [];
      setItems(
        raw.map((x) => ({
          id: String(x.id),
          name: String(x.name),
          refImageUrl: (x.refImageUrl as string | null) ?? null,
          detail: String(x[detailKey] ?? ""),
        }))
      );
    } catch {
      /* ignore */
    }
  }, [apiPath, listKey, detailKey]);

  useEffect(() => {
    // idsKey 变化时重新拉取，纳入新建/导入的模板
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh, idsKey]);

  const imported = items.filter((i) => ids.includes(i.id));
  const Icon = icon === "user" ? FiUser : FiMapPin;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
      <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
        {title}
        <span className="ml-1.5 text-xs font-normal text-[var(--text-caption)]">{imported.length}</span>
      </p>
      {imported.length === 0 ? (
        <p className="py-2 text-xs text-[var(--text-caption)]">未导入，去左栏添加</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {imported.map((it) => (
            <div key={it.id} className="w-20 shrink-0">
              <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-black/30">
                {it.refImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.refImageUrl}
                    alt={it.name}
                    onClick={() => setPreview(it)}
                    className="h-full w-full cursor-zoom-in object-cover"
                    title="点击看大图"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[var(--text-secondary)]">
                    <Icon className="h-6 w-6" />
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-center font-mono text-[11px] font-semibold text-[var(--accent)]">
                @{it.name}
              </p>
            </div>
          ))}
        </div>
      )}

      {preview?.refImageUrl && (
        <div onClick={() => setPreview(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6">
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-full max-w-4xl flex-col overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5">
              <span className="font-mono text-sm font-semibold text-[var(--accent)]">@{preview.name}</span>
              <button type="button" onClick={() => setPreview(null)} className="text-[var(--text-caption)] hover:text-[var(--text-primary)]">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.refImageUrl} alt={preview.name} className="min-h-0 w-full flex-1 object-contain" />
            <p className="border-t border-[var(--border)] px-4 py-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">{preview.detail}</p>
          </div>
        </div>
      )}
    </div>
  );
}
