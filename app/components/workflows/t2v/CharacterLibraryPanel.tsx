"use client";

import { useEffect, useRef, useState } from "react";
import { FiPlus, FiTrash2, FiUser, FiLoader, FiImage } from "react-icons/fi";
import { fileToScaledDataUrl } from "@/app/lib/image-client";

type Character = {
  id: string;
  name: string;
  appearance: string;
  refImageUrl: string | null;
  createdAt: string;
};

export default function CharacterLibraryPanel() {
  const [chars, setChars] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 新增表单
  const [name, setName] = useState("");
  const [appearance, setAppearance] = useState("");
  const [thumb, setThumb] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/characters");
      const data = await res.json();
      if (res.ok) setChars(data.characters ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, []);

  async function handleFile(file: File | undefined | null) {
    if (!file || !file.type.startsWith("image/")) return;
    setErr(null);
    try {
      const dataUrl = await fileToScaledDataUrl(file);
      setThumb(dataUrl);
      setImageDataUrl(dataUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  function resetForm() {
    setName("");
    setAppearance("");
    setThumb(null);
    setImageDataUrl(null);
    setErr(null);
  }

  async function save() {
    if (!name.trim()) {
      setErr("请填写角色名");
      return;
    }
    if (!appearance.trim() && !imageDataUrl) {
      setErr("请填写外观描述，或上传参考图自动提炼");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          appearance: appearance.trim() || undefined,
          imageDataUrl: imageDataUrl ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "创建失败");
      setChars((prev) => [data.character, ...prev]);
      resetForm();
      setAdding(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setChars((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch(`/api/characters?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      refresh();
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-caption)]">
        建好角色后，在提示词里写 <span className="font-mono text-[var(--accent)]">@角色名</span>，
        生成时自动注入外观锚点，保证整部片跨镜头人物一致。
      </p>

      {/* 角色卡片网格 */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--text-caption)]">
          <FiLoader className="h-4 w-4 animate-spin" /> 加载角色库…
        </div>
      ) : chars.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {chars.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]/40 p-3"
            >
              {c.refImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.refImageUrl}
                  alt={c.name}
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                  <FiUser className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-[var(--accent)]">
                    @{c.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    className="shrink-0 text-[var(--text-caption)] hover:text-[var(--danger)]"
                    title="删除角色"
                  >
                    <FiTrash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {c.appearance}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-2 text-sm text-[var(--text-caption)]">还没有角色，添加一个开始吧。</p>
      )}

      {/* 新增表单 */}
      {adding ? (
        <div className="rounded-lg border border-[var(--border)] p-3">
          <div className="flex gap-3">
            <div
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--accent)]/60"
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="参考图" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-[var(--text-caption)]">
                  <FiImage className="h-5 w-5" />
                  <span className="text-[10px]">参考图</span>
                </span>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <input
                className="input-field w-full rounded-lg px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="角色名（用于 @引用，如 六子 / Anna）"
              />
              <textarea
                className="input-field min-h-[60px] w-full rounded-lg px-3 py-2 text-sm"
                value={appearance}
                onChange={(e) => setAppearance(e.target.value)}
                placeholder={
                  imageDataUrl
                    ? "留空则由参考图自动提炼外观锚点（英文）"
                    : "外观描述（英文，服装/发型/特征锚点）"
                }
              />
            </div>
          </div>

          {err && <p className="mt-2 text-xs font-medium text-[var(--danger)]">{err}</p>}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? (
                <FiLoader className="h-4 w-4 animate-spin" />
              ) : (
                <FiPlus className="h-4 w-4" />
              )}
              {saving ? (imageDataUrl && !appearance.trim() ? "提炼并保存…" : "保存…") : "保存角色"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setAdding(false);
              }}
              className="btn-secondary rounded-lg px-3 py-2 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
        >
          <FiPlus className="h-4 w-4" />
          添加角色
        </button>
      )}
    </div>
  );
}
