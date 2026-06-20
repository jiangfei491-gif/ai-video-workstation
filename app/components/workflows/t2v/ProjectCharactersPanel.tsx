"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiDownload,
  FiUser,
  FiLoader,
  FiX,
  FiCheck,
  FiPlus,
  FiImage,
} from "react-icons/fi";
import { fileToScaledDataUrl } from "@/app/lib/image-client";

type Character = {
  id: string;
  name: string;
  appearance: string;
  refImageUrl: string | null;
  createdAt: string;
};

type Props = {
  /** 本项目导入的角色 id */
  characterIds: string[];
  onChange: (ids: string[]) => void;
};

export default function ProjectCharactersPanel({ characterIds, onChange }: Props) {
  const [library, setLibrary] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState<Character | null>(null);

  // 内联新建角色表单
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [appearance, setAppearance] = useState("");
  const [thumb, setThumb] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/characters");
      const data = await res.json();
      if (res.ok) setLibrary(data.characters ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const imported = library.filter((c) => characterIds.includes(c.id));

  function removeFromProject(id: string) {
    onChange(characterIds.filter((x) => x !== id));
  }

  function toggleImport(id: string) {
    onChange(
      characterIds.includes(id)
        ? characterIds.filter((x) => x !== id)
        : [...characterIds, id]
    );
  }

  function openPicker() {
    setPicking(true);
    void refresh(); // 打开时刷新，纳入在角色库页新建的角色
  }

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

  // 保存到角色库（永久），并自动加入当前项目
  async function saveToLibrary() {
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
      setLibrary((prev) => [data.character, ...prev]);
      onChange([...characterIds, data.character.id]); // 自动加入本项目
      resetForm();
      setCreating(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-caption)]">
        从角色库导入本项目要用的角色，分镜提示词里用{" "}
        <span className="font-mono text-[var(--accent)]">@角色名</span>{" "}
        引用。这里「移除」只移出本项目，不会删除角色库里的角色。
      </p>

      {/* 已导入角色 */}
      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-[var(--text-caption)]">
          <FiLoader className="h-4 w-4 animate-spin" /> 加载中…
        </div>
      ) : imported.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {imported.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]/40 p-3"
            >
              {c.refImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.refImageUrl}
                  alt={c.name}
                  onClick={() => setPreview(c)}
                  className="h-14 w-14 shrink-0 cursor-zoom-in rounded-lg object-cover hover:opacity-80"
                  title="点击看大图"
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
                    onClick={() => removeFromProject(c.id)}
                    className="shrink-0 text-xs text-[var(--text-caption)] hover:text-[var(--danger)]"
                    title="移出本项目（不删除角色库）"
                  >
                    移除
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
        <p className="py-2 text-sm text-[var(--text-caption)]">
          本项目还没有角色，点下面「从角色库导入」选择。
        </p>
      )}

      {creating ? (
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
              onClick={saveToLibrary}
              className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiPlus className="h-4 w-4" />}
              {saving ? "保存中…" : "保存到角色库"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setCreating(false);
              }}
              className="btn-secondary rounded-lg px-3 py-2 text-sm"
            >
              取消
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--text-caption)]">
            保存后会永久存入角色库，并自动加入本项目。
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openPicker}
            className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <FiDownload className="h-4 w-4" />
            从角色库导入
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setCreating(true);
            }}
            className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
          >
            <FiPlus className="h-4 w-4" />
            创建角色
          </button>
        </div>
      )}

      {/* 导入选择浮层 */}
      {picking && (
        <div
          onClick={() => setPicking(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                从角色库导入角色
              </span>
              <button
                type="button"
                onClick={() => setPicking(false)}
                className="text-[var(--text-caption)] hover:text-[var(--text-primary)]"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {library.length === 0 ? (
                <div className="py-6 text-center text-sm text-[var(--text-caption)]">
                  角色库还没有角色。
                  <a href="/characters" className="ml-1 text-[var(--accent)] hover:underline">
                    去角色库新建 →
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  {library.map((c) => {
                    const on = characterIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => toggleImport(c.id)}
                        className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                          on
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                            : "border-[var(--border)] hover:border-[var(--accent)]/50"
                        }`}
                      >
                        {c.refImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.refImageUrl}
                            alt={c.name}
                            className="h-12 w-12 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-inset)] text-[var(--text-secondary)]">
                            <FiUser className="h-5 w-5" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="font-mono text-sm font-semibold text-[var(--accent)]">
                            @{c.name}
                          </span>
                          <p className="line-clamp-1 text-xs text-[var(--text-secondary)]">
                            {c.appearance}
                          </p>
                        </div>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            on
                              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                              : "border-[var(--border)]"
                          }`}
                        >
                          {on && <FiCheck className="h-3 w-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
              <span className="text-xs text-[var(--text-caption)]">
                已导入 {imported.length} 个
              </span>
              <button
                type="button"
                onClick={() => setPicking(false)}
                className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 大图浮层 */}
      {preview?.refImageUrl && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full max-w-4xl flex-col overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5">
              <span className="font-mono text-sm font-semibold text-[var(--accent)]">
                @{preview.name}
              </span>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-[var(--text-caption)] hover:text-[var(--text-primary)]"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.refImageUrl}
              alt={preview.name}
              className="min-h-0 w-full flex-1 object-contain"
            />
            <p className="border-t border-[var(--border)] px-4 py-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
              {preview.appearance}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
