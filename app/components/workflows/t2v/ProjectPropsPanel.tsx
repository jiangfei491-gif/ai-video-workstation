"use client";

import { useCallback, useEffect, useState } from "react";
import { FiBox, FiCheck, FiPlus, FiX } from "react-icons/fi";

type Prop = {
  id: string;
  name: string;
  description: string;
  category: string;
  createdAt: string;
};

type Props = {
  propIds: string[];
  onChange: (ids: string[]) => void;
};

export default function ProjectPropsPanel({ propIds, onChange }: Props) {
  const [library, setLibrary] = useState<Prop[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/props");
      const data = await res.json();
      if (res.ok) setLibrary(data.props ?? []);
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

  const imported = library.filter((p) => propIds.includes(p.id));

  async function createProp() {
    if (!name.trim() || !description.trim()) {
      setErr("请填写道具名和描述");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/props", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "创建失败");
      onChange([...propIds, data.prop.id as string]);
      setCreating(false);
      setName("");
      setDescription("");
      void refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-[var(--text-caption)]">加载道具库…</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-caption)]">
        道具 Bible：汽车、手机、警车等固定物体。Prompt 中用 @道具名 引用，避免每张图道具漂移。
      </p>
      {imported.length > 0 && (
        <ul className="space-y-2">
          {imported.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium text-[var(--accent)]">@{p.name}</span>
                <span className="ml-2 text-[var(--text-caption)]">{p.category}</span>
              </span>
              <button type="button" onClick={() => onChange(propIds.filter((x) => x !== p.id))} className="text-[var(--text-caption)] hover:text-[var(--danger)]">
                <FiX />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPicking(true)} className="btn-secondary inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs">
          <FiBox className="h-3.5 w-3.5" /> 从库导入
        </button>
        <button type="button" onClick={() => setCreating(true)} className="btn-secondary inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs">
          <FiPlus className="h-3.5 w-3.5" /> 新建道具
        </button>
      </div>
      {creating && (
        <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
          <input className="input-field w-full rounded-lg px-2 py-1.5 text-sm" placeholder="道具名（如 警车A）" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input-field w-full rounded-lg px-2 py-1.5 text-sm" placeholder="分类 vehicle / phone / furniture" value={category} onChange={(e) => setCategory(e.target.value)} />
          <textarea className="input-field w-full rounded-lg px-2 py-1.5 text-sm" placeholder="英文描述：型号、颜色、材质…" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          {err && <p className="text-xs text-[var(--danger)]">{err}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={() => void createProp()} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs text-white disabled:opacity-50">
              {saving ? "保存中…" : "保存并导入"}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="btn-secondary rounded-lg px-3 py-1.5 text-xs">取消</button>
          </div>
        </div>
      )}
      {picking && (
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">选择道具</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {library.map((p) => {
              const on = propIds.includes(p.id);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => onChange(on ? propIds.filter((x) => x !== p.id) : [...propIds, p.id])} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${on ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--bg-inset)]"}`}>
                    @{p.name}
                    {on && <FiCheck className="h-4 w-4 text-[var(--accent)]" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => setPicking(false)} className="mt-2 text-xs text-[var(--text-caption)]">关闭</button>
        </div>
      )}
    </div>
  );
}
