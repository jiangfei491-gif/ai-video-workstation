"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiPlus,
  FiSearch,
  FiLoader,
  FiStar,
  FiX,
  FiTrash2,
  FiZap,
  FiFileText,
  FiFilm,
  FiCheckCircle,
  FiCompass,
} from "react-icons/fi";
import { MATERIAL_CATEGORIES, type Material } from "@/app/lib/materials/types";
import { setT2VState } from "@/app/lib/workbench-persist/t2v-store";

const STATUSES = ["待分析", "已分析", "已生成脚本", "已生成视频"] as const;

export default function MaterialCenter() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("全部素材");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/materials");
      const data = await res.json();
      if (res.ok) setMaterials(data.materials ?? []);
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

  // 详情直接从列表派生，始终是最新数据（分析/脚本后自动刷新）
  const detail = detailId ? materials.find((m) => m.id === detailId) ?? null : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials.filter((m) => {
      if (cat !== "全部素材" && m.category !== cat) return false;
      if (statusFilter === "收藏" && !m.favorite) return false;
      if (statusFilter && statusFilter !== "收藏" && m.status !== statusFilter) return false;
      if (q && !(`${m.title} ${m.content} ${m.source}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [materials, cat, statusFilter, search]);

  function applyUpdated(m: Material) {
    setMaterials((prev) => prev.map((x) => (x.id === m.id ? m : x)));
  }

  async function analyze(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch("/api/materials/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "分析失败");
      applyUpdated(data.material);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function genScript(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch("/api/materials/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "脚本生成失败");
      applyUpdated(data.material);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    try {
      const res = await fetch("/api/materials/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await res.json();
      if (res.ok) applyUpdated(data.material);
    } catch {
      /* ignore */
    }
  }

  async function removeMaterial(id: string) {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    setDetailId(null);
    try {
      await fetch(`/api/materials?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      refresh();
    }
  }

  async function batchAnalyze() {
    const pending = filtered.filter((m) => m.status === "待分析");
    if (pending.length === 0) return;
    setBatchBusy(true);
    setErr(null);
    for (const m of pending) {
      await analyze(m.id);
    }
    setBatchBusy(false);
  }

  function toStoryboard(m: Material) {
    // 把素材标题塞进视频创作，跳转去跑编导分镜
    setT2VState({ topic: m.title });
    window.location.href = "/ai-video";
  }

  return (
    <div className="flex h-full min-h-0">
      {/* 左侧分类/状态 */}
      <aside className="w-44 shrink-0 overflow-y-auto border-r border-[var(--border)] p-3">
        <p className="mb-2 text-xs font-semibold text-[var(--text-caption)]">分类</p>
        <div className="space-y-0.5">
          {["全部素材", ...MATERIAL_CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`block w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                cat === c ? "nav-item-active font-semibold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="mb-2 mt-4 text-xs font-semibold text-[var(--text-caption)]">状态</p>
        <div className="space-y-0.5">
          {["", ...STATUSES, "收藏"].map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`block w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                statusFilter === s ? "nav-item-active font-semibold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]"
              }`}
            >
              {s === "" ? "全部状态" : s}
            </button>
          ))}
        </div>
      </aside>

      {/* 主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 操作栏 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <button type="button" onClick={() => setAgentOpen(true)} className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium">
            <FiCompass className="h-4 w-4" />AI 找素材
          </button>
          <button type="button" onClick={() => setImporting(true)} className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
            <FiPlus className="h-4 w-4" />手动导入
          </button>
          <button type="button" onClick={batchAnalyze} disabled={batchBusy} className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm disabled:opacity-50">
            {batchBusy ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiZap className="h-4 w-4" />}AI分析待分析
          </button>
          <button type="button" disabled title="第2周上线" className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm opacity-50">
            去重<span className="text-[10px]">(第2周)</span>
          </button>
          <div className="relative ml-auto">
            <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-caption)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标题/来源/正文"
              className="input-field w-64 rounded-lg py-2 pl-8 pr-3 text-sm"
            />
          </div>
        </div>

        {err && <p className="px-4 py-2 text-sm font-medium text-[var(--danger)]">{err}</p>}

        {/* 列表 */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-[var(--text-caption)]">
              <FiLoader className="h-4 w-4 animate-spin" /> 加载中…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--text-caption)]">
              没有素材。点左上「采集素材」手动导入第一条。
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--bg-surface)] text-left text-xs text-[var(--text-caption)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-2 font-medium">标题</th>
                  <th className="px-3 py-2 font-medium">来源</th>
                  <th className="px-3 py-2 font-medium">分类</th>
                  <th className="px-3 py-2 font-medium">评分</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                  <th className="px-3 py-2 font-medium">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => setDetailId(m.id)}
                    className="cursor-pointer border-b border-[var(--border)] hover:bg-[var(--bg-inset)]"
                  >
                    <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                      {m.favorite && <FiStar className="mr-1 inline h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]" />}
                      {m.title}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">{m.source}</td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">{m.category}</td>
                    <td className="px-3 py-2.5">
                      {m.analysis ? (
                        <span className="font-semibold text-[var(--accent)]">{m.analysis.score.toFixed(1)}</span>
                      ) : (
                        <span className="text-[var(--text-caption)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-[var(--bg-inset)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">{m.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--text-caption)]">{m.createdAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {agentOpen && <AgentDialog onClose={() => setAgentOpen(false)} onDone={refresh} />}
      {importing && <ImportForm onClose={() => setImporting(false)} onCreated={(m) => { setMaterials((p) => [m, ...p]); setImporting(false); }} />}
      {detail && (
        <DetailModal
          m={detail}
          busy={busyId === detail.id}
          onClose={() => setDetailId(null)}
          onAnalyze={() => analyze(detail.id)}
          onGenScript={() => genScript(detail.id)}
          onFav={() => patch(detail.id, { favorite: !detail.favorite })}
          onMark={() => patch(detail.id, { status: "已生成视频" })}
          onStoryboard={() => toStoryboard(detail)}
          onDelete={() => removeMaterial(detail.id)}
        />
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div className="grid grid-cols-[64px_1fr] gap-2 py-1 text-sm">
      <span className="text-[var(--text-caption)]">{k}</span>
      <span className="text-[var(--text-secondary)]">{v}</span>
    </div>
  );
}

function ImportForm({ onClose, onCreated }: { onClose: () => void; onCreated: (m: Material) => void }) {
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<string>(MATERIAL_CATEGORIES[0]);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) { setErr("请填写标题"); return; }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, source, url, category, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      onCreated(data.material);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-xl bg-[var(--bg-surface)] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">采集素材（手动导入）</h3>
          <button type="button" onClick={onClose} className="text-[var(--text-caption)] hover:text-[var(--text-primary)]"><FiX className="h-5 w-5" /></button>
        </div>
        <div className="space-y-2.5">
          <input className="input-field w-full rounded-lg px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题（必填）" />
          <div className="flex gap-2">
            <input className="input-field flex-1 rounded-lg px-3 py-2 text-sm" value={source} onChange={(e) => setSource(e.target.value)} placeholder="来源，如 Reddit / 知乎" />
            <select className="input-field rounded-lg px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
              {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input className="input-field w-full rounded-lg px-3 py-2 text-sm" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="网址（可选）" />
          <textarea className="input-field min-h-[160px] w-full rounded-lg px-3 py-2 text-sm" value={content} onChange={(e) => setContent(e.target.value)} placeholder="正文 / 原始内容" />
        </div>
        {err && <p className="mt-2 text-xs font-medium text-[var(--danger)]">{err}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary rounded-lg px-4 py-2 text-sm">取消</button>
          <button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiPlus className="h-4 w-4" />}保存
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [task, setTask] = useState("适合历史频道、有人物有冲突有结局的真实历史故事");
  const [category, setCategory] = useState<string>("历史");
  const [count, setCount] = useState(5);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    if (!task.trim()) { setErr("请填写要找什么素材"); return; }
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/materials/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, count, category, autoAnalyze }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Agent 运行失败");
      setResult(`找到 ${data.found} 篇 · 入库 ${data.created} 篇 · 跳过重复 ${data.skipped} 篇`);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-xl bg-[var(--bg-surface)] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">AI 找素材（联网搜索）</h3>
          <button type="button" onClick={onClose} className="text-[var(--text-caption)] hover:text-[var(--text-primary)]"><FiX className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-[var(--text-caption)]">
          Agent 用 OpenAI 联网搜索去全网找素材、自动入库（可顺带分析）。会自动去重。联网搜索按次计费，建议先小批量。
        </p>
        <div className="space-y-2.5">
          <textarea className="input-field min-h-[70px] w-full rounded-lg px-3 py-2 text-sm" value={task} onChange={(e) => setTask(e.target.value)} placeholder="要找什么素材？例如：适合历史频道、有反转的真实悬案" />
          <div className="flex items-center gap-2">
            <select className="input-field rounded-lg px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
              {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="text-sm text-[var(--text-secondary)]">数量
              <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="input-field ml-2 w-16 rounded-lg px-2 py-1.5 text-sm" />
            </label>
            <label className="ml-auto flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
              <input type="checkbox" checked={autoAnalyze} onChange={(e) => setAutoAnalyze(e.target.checked)} />自动分析
            </label>
          </div>
        </div>
        {err && <p className="mt-2 text-xs font-medium text-[var(--danger)]">{err}</p>}
        {result && <p className="mt-2 text-sm font-medium text-[var(--accent)]">{result}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary rounded-lg px-4 py-2 text-sm">关闭</button>
          <button type="button" onClick={run} disabled={busy} className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {busy ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiCompass className="h-4 w-4" />}{busy ? "搜索入库中…" : "开始找素材"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({
  m, busy, onClose, onAnalyze, onGenScript, onFav, onMark, onStoryboard, onDelete,
}: {
  m: Material; busy: boolean; onClose: () => void;
  onAnalyze: () => void; onGenScript: () => void; onFav: () => void;
  onMark: () => void; onStoryboard: () => void; onDelete: () => void;
}) {
  const a = m.analysis;
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">{m.title}</h3>
            <p className="text-xs text-[var(--text-caption)]">{m.source} · {m.category} · {m.status}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--text-caption)] hover:text-[var(--text-primary)]"><FiX className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* 原始内容 */}
          <section className="mb-4">
            <p className="mb-1.5 text-sm font-semibold text-[var(--text-primary)]">原始内容</p>
            {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent)] hover:underline">{m.url}</a>}
            <p className="mt-1 whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              {m.content || "（无正文）"}
            </p>
          </section>

          {/* AI 分析 */}
          <section className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">AI 分析</p>
              {a && <span className="text-sm font-semibold text-[var(--accent)]">视频评分 {a.score.toFixed(1)}</span>}
            </div>
            {a ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3">
                <Row k="概括" v={a.summary} />
                <Row k="人物" v={a.characters} />
                <Row k="地点" v={a.location} />
                <Row k="时间" v={a.timeline} />
                <Row k="冲突" v={a.conflict} />
                <Row k="转折" v={a.twist} />
                <Row k="高潮" v={a.climax} />
                <Row k="结局" v={a.ending} />
                <Row k="情绪" v={a.emotion} />
                {a.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.tags.map((t, i) => <span key={i} className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">{t}</span>)}
                  </div>
                )}
                {/* AI 建议 */}
                {(a.suitability.length > 0 || a.tracks.length > 0) && (
                  <div className="mt-3 border-t border-[var(--border)] pt-2 text-sm">
                    {a.suitability.length > 0 && <p className="text-[var(--text-secondary)]"><span className="text-[var(--text-caption)]">适合：</span>{a.suitability.join(" · ")}</p>}
                    {a.tracks.length > 0 && <p className="text-[var(--text-secondary)]"><span className="text-[var(--text-caption)]">推荐赛道：</span>{a.tracks.join(" · ")}</p>}
                  </div>
                )}
              </div>
            ) : (
              <button type="button" onClick={onAnalyze} disabled={busy} className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {busy ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiZap className="h-4 w-4" />}{busy ? "分析中…" : "AI 分析"}
              </button>
            )}
          </section>

          {/* 脚本 */}
          {m.scripts.length > 0 && (
            <section className="mb-4">
              <p className="mb-1.5 text-sm font-semibold text-[var(--text-primary)]">脚本（{m.scripts.length}）</p>
              {m.scripts.map((s) => (
                <p key={s.id} className="mb-2 whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3 text-sm leading-relaxed text-[var(--text-secondary)]">{s.script}</p>
              ))}
            </section>
          )}
        </div>

        {/* 操作 */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-5 py-3">
          <button type="button" onClick={onGenScript} disabled={busy} className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50">
            {busy ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiFileText className="h-4 w-4" />}生成脚本
          </button>
          <button type="button" onClick={onStoryboard} className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
            <FiFilm className="h-4 w-4" />生成分镜（去视频创作）
          </button>
          <button type="button" onClick={onFav} className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
            <FiStar className={`h-4 w-4 ${m.favorite ? "fill-[var(--accent)] text-[var(--accent)]" : ""}`} />{m.favorite ? "已收藏" : "加入收藏"}
          </button>
          <button type="button" onClick={onMark} className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
            <FiCheckCircle className="h-4 w-4" />标记已制作
          </button>
          <button type="button" onClick={onDelete} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--text-caption)] hover:text-[var(--danger)]">
            <FiTrash2 className="h-4 w-4" />删除
          </button>
        </div>
      </div>
    </div>
  );
}
