"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
  FiPlay,
  FiCheckCircle,
  FiCompass,
  FiTrendingUp,
  FiClock,
} from "react-icons/fi";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_SEARCH_CATEGORIES,
  MATERIAL_SEARCH_LANGUAGES,
  MATERIAL_SEARCH_PROVIDER_OPTIONS,
  formatMaterialLanguageNote,
  formatSafetyLevelLabel,
  getMaterialLockFields,
  getMaterialSearchProviderLabel,
  type Material,
  type MaterialSearchLanguage,
  type MaterialSearchProviderChoice,
} from "@/app/lib/materials/types";
import type {
  EvolutionRecommendation,
  EvolutionRun,
  ModelPerformanceEntry,
  ScriptRecord,
  ScriptRewriteMode,
  StylePerformanceEntry,
} from "@/app/lib/materials/script-evolution/types";
import { SCRIPT_PROVIDERS, SCRIPT_REWRITE_MODES, SCRIPT_STYLES } from "@/app/lib/materials/script-evolution/types";
import {
  DURATION_PRESETS_MINUTES,
  buildDurationPlan,
  estimateEvolutionMeta,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
} from "@/app/lib/materials/script-evolution/duration-config";
import {
  clearEvolutionRun,
  getEvolutionRunState,
  startEvolution,
  subscribeEvolutionRun,
} from "@/app/lib/materials/script-evolution/run-manager";
import {
  defaultAgentTaskForCategory,
  resolveAgentTaskOnCategoryChange,
} from "@/app/lib/materials/agent-task-templates";
import { setT2VState } from "@/app/lib/workbench-persist/t2v-store";
import { buildShotPlan } from "@/app/lib/shot-control/plan-from-script";
import { cacheProjectScript } from "@/app/lib/workbench-persist/script-cache";
import {
  SCHEDULE_WEEKDAYS,
  type MaterialSchedule,
  type ScheduleFrequency,
} from "@/app/lib/materials/schedule-types";
import {
  formatScheduleDateTime,
  formatScheduleLastResult,
  formatScheduleWhen,
} from "@/app/lib/materials/schedule-utils";

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
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [enabledScheduleCount, setEnabledScheduleCount] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // 进化状态来自模块级单例：切页/离开内容中心不中断，回来还在
  const evo = useSyncExternalStore(subscribeEvolutionRun, getEvolutionRunState, getEvolutionRunState);
  const evolutionRun = evo.run;
  const evolutionStage = evo.stage;
  const evolutionStats = evo.stats;
  const [evolutionSetupId, setEvolutionSetupId] = useState<string | null>(null);
  const [evolutionStatsOpen, setEvolutionStatsOpen] = useState(false);
  const [storyboardPickMaterial, setStoryboardPickMaterial] = useState<Material | null>(null);
  const [rewriteBusyKey, setRewriteBusyKey] = useState<string | null>(null);
  const [deletingScriptId, setDeletingScriptId] = useState<string | null>(null);

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

  useEffect(() => {
    void fetch("/api/materials/schedules")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.schedules ?? []) as MaterialSchedule[];
        setEnabledScheduleCount(list.filter((s) => s.enabled).length);
      })
      .catch(() => {
        /* ignore */
      });
  }, [scheduleOpen]);

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

  // 进化完成时（可能发生在切页期间），把更新后的素材应用到列表，只应用一次
  const appliedEvoSeq = useRef(0);
  useEffect(() => {
    if (evo.seq > appliedEvoSeq.current && evo.material) {
      appliedEvoSeq.current = evo.seq;
      setMaterials((prev) => prev.map((x) => (x.id === evo.material!.id ? evo.material! : x)));
    }
  }, [evo.seq, evo.material]);

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

  // 进化交给模块级单例：切页/离开内容中心也不中断
  function evolveScript(id: string, durationMinutes: number) {
    setEvolutionSetupId(null);
    void startEvolution(id, durationMinutes);
  }

  async function rewriteScript(
    materialId: string,
    script: string,
    mode: ScriptRewriteMode,
    baseTitle: string
  ) {
    const key = `${materialId}:${mode}`;
    setRewriteBusyKey(key);
    setErr(null);
    try {
      const res = await fetch("/api/materials/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId, script, mode, baseTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "局部改写失败");
      applyUpdated(data.material as Material);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRewriteBusyKey(null);
    }
  }

  async function deleteScript(materialId: string, scriptId: string) {
    if (!window.confirm("确定删除这条脚本？此操作不可撤销。")) return;
    setDeletingScriptId(scriptId);
    setErr(null);
    try {
      const res = await fetch(
        `/api/materials/script?materialId=${encodeURIComponent(materialId)}&scriptId=${encodeURIComponent(scriptId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "删除失败");
      applyUpdated(data.material as Material);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingScriptId(null);
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

  function toStoryboard(
    m: Material,
    script?: { text: string; title: string; id?: string }
  ) {
    const topic = m.title;
    const plan =
      script ?
        buildShotPlan({
          scriptText: script.text,
          scriptTitle: script.title,
          pipelineMode: "t2i",
        })
      : buildShotPlan({ pipelineMode: "t2i", targetDurationMinutes: 1 });
    setT2VState({
      topic,
      pipelineMode: "t2i",
      sourceScript: script?.text,
      sourceScriptLabel: script?.title,
      targetDurationMinutes: plan.targetDurationMinutes,
      imageBudget: plan.imageBudget,
      imageBudgetMode: plan.imageBudgetMode,
      editRenderMode: "image",
      director: null,
      testResult: null,
      prodResult: null,
      batchResults: {},
    });
    if (script?.text?.trim()) {
      cacheProjectScript(script.text, script.title);
    }
    window.location.href = "/ai-video";
  }

  function toAiDirector(m: Material, script?: { text: string; title: string; id?: string }) {
    setT2VState({
      topic: m.title,
      sourceScript: script?.text,
      sourceScriptLabel: script?.title,
      director: null,
    });
    if (script?.text?.trim()) {
      cacheProjectScript(script.text, script.title);
    }
    window.location.href = "/ai-director?autorun=1";
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
          <button type="button" onClick={() => setScheduleOpen(true)} className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
            <FiClock className="h-4 w-4" />
            自动 AI 找素材
            {enabledScheduleCount > 0 && (
              <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {enabledScheduleCount}
              </span>
            )}
          </button>
          <button type="button" onClick={() => setImporting(true)} className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
            <FiPlus className="h-4 w-4" />手动导入
          </button>
          <button
            type="button"
            onClick={() => setEvolutionStatsOpen(true)}
            className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
          >
            <FiTrendingUp className="h-4 w-4" />
            进化数据
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

        {(err || evo.error) && <p className="px-4 py-2 text-sm font-medium text-[var(--danger)]">{err || evo.error}</p>}

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
                  <th className="px-3 py-2 font-medium">类型</th>
                  <th className="px-3 py-2 font-medium">原文</th>
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
                    <td className="px-3 py-2.5 text-xs text-[var(--text-caption)]">
                      {(() => {
                        const lock = getMaterialLockFields(m);
                        return `${lock.contentType} · ${formatSafetyLevelLabel(lock.contentType)} · ${lock.truthLock}%`;
                      })()}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--text-caption)]">
                      {formatMaterialLanguageNote(m.language) ?? "—"}
                    </td>
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
      {scheduleOpen && (
        <AutoScheduleDialog
          onClose={() => setScheduleOpen(false)}
          onChanged={(count) => {
            setEnabledScheduleCount(count);
            void refresh();
          }}
        />
      )}
      {importing && <ImportForm onClose={() => setImporting(false)} onCreated={(m) => { setMaterials((p) => [m, ...p]); setImporting(false); }} />}
      {detail && (
        <DetailModal
          m={detail}
          busy={busyId === detail.id || evo.runningId === detail.id}
          onClose={() => setDetailId(null)}
          onAnalyze={() => analyze(detail.id)}
          onGenScript={() => genScript(detail.id)}
          onEvolve={() => setEvolutionSetupId(detail.id)}
          onRewrite={(script, mode, baseTitle) =>
            rewriteScript(detail.id, script, mode, baseTitle)
          }
          rewriteBusyKey={rewriteBusyKey}
          deletingScriptId={deletingScriptId}
          onDeleteScript={(scriptId) => deleteScript(detail.id, scriptId)}
          onFav={() => patch(detail.id, { favorite: !detail.favorite })}
          onMark={() => patch(detail.id, { status: "已生成视频" })}
          onStoryboard={() => {
            if (detail.scripts.length <= 1) {
              const s = detail.scripts[0];
              toStoryboard(
                detail,
                s ? { text: s.script, title: s.title, id: s.id } : undefined
              );
            } else {
              setStoryboardPickMaterial(detail);
            }
          }}
          onStoryboardWithScript={(scriptId) => {
            const s = detail.scripts.find((x) => x.id === scriptId);
            if (s) toAiDirector(detail, { text: s.script, title: s.title, id: s.id });
          }}
          onDelete={() => removeMaterial(detail.id)}
        />
      )}
      {evolutionSetupId && (
        <EvolutionSetupDialog
          materialId={evolutionSetupId}
          materialTitle={detail?.title ?? ""}
          onClose={() => setEvolutionSetupId(null)}
          onStart={(durationMinutes) => void evolveScript(evolutionSetupId, durationMinutes)}
        />
      )}
      {evolutionStage && (
        <EvolutionProgressModal
          stage={evolutionStage}
          candidateCount={evolutionStats.candidates}
          outlineCount={evolutionStats.outlines}
          roundCount={evolutionStats.rounds}
        />
      )}
      {evolutionRun?.status === "completed" && !evolutionStage && (
        <EvolutionResultModal run={evolutionRun} onClose={clearEvolutionRun} />
      )}
      {evolutionStatsOpen && (
        <EvolutionStatsDialog onClose={() => setEvolutionStatsOpen(false)} />
      )}
      {storyboardPickMaterial && (
        <StoryboardScriptPickDialog
          material={storyboardPickMaterial}
          onClose={() => setStoryboardPickMaterial(null)}
          onPick={(script) => {
            setStoryboardPickMaterial(null);
            toStoryboard(storyboardPickMaterial, script);
          }}
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
  const [task, setTask] = useState(() => defaultAgentTaskForCategory("历史"));
  const [language, setLanguage] = useState<MaterialSearchLanguage>("zh");
  const [category, setCategory] = useState<string>("历史");
  const [searchProvider, setSearchProvider] = useState<MaterialSearchProviderChoice>("all");
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
        body: JSON.stringify({ task, count, category, language, searchProvider, autoAnalyze }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Agent 运行失败");
      setResult(
        `找到 ${data.found} 篇 · 入库 ${data.created} 篇 · 跳过重复 ${data.skipped} 篇` +
          (data.searchProvider
            ? ` · 搜索：${data.searchProvider}${data.searchModel ? `/${data.searchModel}` : ""}`
            : "")
      );
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
          Agent 按所选语言在对应语种互联网搜索（选「全部」则多语种检索）；分类选「全部」时 AI 自动匹配入库分类。搜索模型选「全部」时优先 GPT 联网搜索、失败自动切换 Gemini；也可指定单一模型。入库后标题与正文统一为中文展示；非中文来源会标注「原文：xx」。会自动去重，联网搜索按次计费，建议先小批量。
        </p>
        <div className="space-y-2.5">
          <p className="text-xs text-[var(--text-caption)]">
            下方「任务描述」是发给 AI 的主要指令；「分类」决定入库标签与筛选倾向，两者需一致。
          </p>
          <textarea className="input-field min-h-[70px] w-full rounded-lg px-3 py-2 text-sm" value={task} onChange={(e) => setTask(e.target.value)} placeholder="要找什么素材？例如：适合科技频道、有突破转折的真实创新故事" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-[var(--text-secondary)]">搜索语种
              <select className="input-field ml-2 rounded-lg px-3 py-2 text-sm" value={language} onChange={(e) => setLanguage(e.target.value as MaterialSearchLanguage)}>
                {MATERIAL_SEARCH_LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <label className="text-sm text-[var(--text-secondary)]">分类
              <select
                className="input-field ml-2 rounded-lg px-3 py-2 text-sm"
                value={category}
                onChange={(e) => {
                  const next = e.target.value;
                  setCategory(next);
                  setTask((prev) => resolveAgentTaskOnCategoryChange(prev, next));
                }}
              >
                {MATERIAL_SEARCH_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-sm text-[var(--text-secondary)]">搜索模型
              <select
                className="input-field ml-2 rounded-lg px-3 py-2 text-sm"
                value={searchProvider}
                onChange={(e) => setSearchProvider(e.target.value as MaterialSearchProviderChoice)}
              >
                {MATERIAL_SEARCH_PROVIDER_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </label>
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

function AutoScheduleDialog({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: (enabledCount: number) => void;
}) {
  const [schedules, setSchedules] = useState<MaterialSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [task, setTask] = useState(() => defaultAgentTaskForCategory("历史"));
  const [category, setCategory] = useState("历史");
  const [language, setLanguage] = useState<MaterialSearchLanguage>("zh");
  const [searchProvider, setSearchProvider] = useState<MaterialSearchProviderChoice>("all");
  const [count, setCount] = useState(5);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [frequency, setFrequency] = useState<ScheduleFrequency>("daily");
  const [timeOfDay, setTimeOfDay] = useState("08:00");
  const [weekday, setWeekday] = useState(1);
  const [intervalHours, setIntervalHours] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refreshSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/materials/schedules");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      const list = (data.schedules ?? []) as MaterialSchedule[];
      setSchedules(list);
      onChanged(list.filter((s) => s.enabled).length);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [onChanged]);

  useEffect(() => {
    void refreshSchedules();
  }, [refreshSchedules]);

  async function createSchedule() {
    if (!task.trim()) {
      setErr("请填写任务描述");
      return;
    }
    setBusy("create");
    setErr(null);
    try {
      const res = await fetch("/api/materials/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          task,
          count,
          category,
          language,
          searchProvider,
          autoAnalyze,
          frequency,
          timeOfDay,
          weekday: frequency === "weekly" ? weekday : undefined,
          intervalHours: frequency === "interval" ? intervalHours : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "创建失败");
      setShowForm(false);
      setName("");
      await refreshSchedules();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function toggleEnabled(schedule: MaterialSchedule) {
    setBusy(schedule.id);
    setErr(null);
    try {
      const res = await fetch(`/api/materials/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !schedule.enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "更新失败");
      await refreshSchedules();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function runNow(id: string) {
    setBusy(`run:${id}`);
    setErr(null);
    try {
      const res = await fetch(`/api/materials/schedules/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "运行失败");
      await refreshSchedules();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function removeSchedule(id: string) {
    if (!window.confirm("确定删除这条定时任务？")) return;
    setBusy(`del:${id}`);
    setErr(null);
    try {
      const res = await fetch(`/api/materials/schedules/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "删除失败");
      await refreshSchedules();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">自动 AI 找素材</h3>
            <p className="text-xs text-[var(--text-caption)]">
              到点自动联网搜索并入库；支持每天/每周，或按小时间隔（如每小时 3 条）；需保持本工作站服务运行，按次计费
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--text-caption)] hover:text-[var(--text-primary)]">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-caption)]">
              <FiLoader className="h-4 w-4 animate-spin" /> 加载中…
            </div>
          ) : schedules.length === 0 && !showForm ? (
            <div className="py-8 text-center text-sm text-[var(--text-caption)]">
              还没有定时任务。点击下方按钮创建第一条。
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((s) => (
                <div key={s.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">{s.name}</p>
                      <p className="text-xs text-[var(--text-caption)]">
                        {formatScheduleWhen(
                          s.frequency,
                          s.timeOfDay,
                          s.weekday,
                          s.intervalHours,
                          s.count
                        )}{" "}
                        · {getMaterialSearchProviderLabel(s.searchProvider ?? "all")} · {s.category}
                        {s.enabled ? " · 已启用" : " · 已暂停"}
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        disabled={busy !== null}
                        onChange={() => void toggleEnabled(s)}
                      />
                      启用
                    </label>
                  </div>
                  <p className="mb-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{s.task}</p>
                  <p className="mb-2 text-xs text-[var(--text-caption)]">
                    上次：{s.lastRunAt ? `${formatScheduleDateTime(s.lastRunAt)} · ` : ""}
                    {formatScheduleLastResult(s.lastResult)}
                  </p>
                  <p className="mb-2 text-xs text-[var(--text-caption)]">
                    下次：{formatScheduleDateTime(s.nextRunAt)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void runNow(s.id)}
                      className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] disabled:opacity-50"
                    >
                      {busy === `run:${s.id}` ? (
                        <FiLoader className="inline h-3 w-3 animate-spin" />
                      ) : (
                        "立即运行"
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void removeSchedule(s.id)}
                      className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-caption)] hover:text-[var(--danger)] disabled:opacity-50"
                    >
                      {busy === `del:${s.id}` ? (
                        <FiLoader className="inline h-3 w-3 animate-spin" />
                      ) : (
                        "删除"
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showForm && (
            <div className="mt-4 space-y-2.5 rounded-lg border border-[var(--border)] p-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">新建定时任务</p>
              <input
                className="input-field w-full rounded-lg px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="任务名称（可选，留空自动生成）"
              />
              <textarea
                className="input-field min-h-[70px] w-full rounded-lg px-3 py-2 text-sm"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="要找什么素材？切换分类会自动更新默认描述（手动改过则保留）"
              />
              <p className="text-xs text-[var(--text-caption)]">
                任务描述是主指令；分类决定入库标签。两者不一致时以任务描述为准。
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-[var(--text-secondary)]">
                  搜索语种
                  <select
                    className="input-field ml-2 rounded-lg px-3 py-2 text-sm"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as MaterialSearchLanguage)}
                  >
                    {MATERIAL_SEARCH_LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-[var(--text-secondary)]">
                  分类
                  <select
                    className="input-field ml-2 rounded-lg px-3 py-2 text-sm"
                    value={category}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCategory(next);
                      setTask((prev) => resolveAgentTaskOnCategoryChange(prev, next));
                    }}
                  >
                    {MATERIAL_SEARCH_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-[var(--text-secondary)]">
                  搜索模型
                  <select
                    className="input-field ml-2 rounded-lg px-3 py-2 text-sm"
                    value={searchProvider}
                    onChange={(e) =>
                      setSearchProvider(e.target.value as MaterialSearchProviderChoice)
                    }
                  >
                    {MATERIAL_SEARCH_PROVIDER_OPTIONS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-[var(--text-secondary)]">
                  每次条数
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={count}
                    onChange={(e) =>
                      setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                    }
                    className="input-field ml-2 w-16 rounded-lg px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-[var(--text-secondary)]">
                  频率
                  <select
                    className="input-field ml-2 rounded-lg px-3 py-2 text-sm"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
                  >
                    <option value="daily">每天</option>
                    <option value="weekly">每周</option>
                    <option value="interval">按小时间隔</option>
                  </select>
                </label>
                {frequency === "weekly" && (
                  <label className="text-sm text-[var(--text-secondary)]">
                    星期
                    <select
                      className="input-field ml-2 rounded-lg px-3 py-2 text-sm"
                      value={weekday}
                      onChange={(e) => setWeekday(Number(e.target.value))}
                    >
                      {SCHEDULE_WEEKDAYS.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {frequency === "interval" && (
                  <label className="text-sm text-[var(--text-secondary)]">
                    间隔
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={intervalHours}
                      onChange={(e) =>
                        setIntervalHours(
                          Math.max(1, Math.min(168, Number(e.target.value) || 1))
                        )
                      }
                      className="input-field ml-2 w-16 rounded-lg px-2 py-1.5 text-sm"
                    />
                    <span className="ml-1">小时</span>
                  </label>
                )}
                {frequency !== "interval" && (
                  <label className="text-sm text-[var(--text-secondary)]">
                    时间
                    <input
                      type="time"
                      value={timeOfDay}
                      onChange={(e) => setTimeOfDay(e.target.value)}
                      className="input-field ml-2 rounded-lg px-3 py-2 text-sm"
                    />
                  </label>
                )}
                {frequency === "interval" && (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIntervalHours(1);
                        setCount(3);
                      }}
                      className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)]"
                    >
                      每小时 3 条
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIntervalHours(4);
                        setCount(1);
                      }}
                      className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)]"
                    >
                      每 4 小时 1 条
                    </button>
                  </div>
                )}
                <label className="ml-auto flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={autoAnalyze}
                    onChange={(e) => setAutoAnalyze(e.target.checked)}
                  />
                  自动分析
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary rounded-lg px-3 py-1.5 text-sm"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={busy === "create"}
                  onClick={() => void createSchedule()}
                  className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  {busy === "create" ? (
                    <FiLoader className="h-4 w-4 animate-spin" />
                  ) : (
                    <FiPlus className="h-4 w-4" />
                  )}
                  保存任务
                </button>
              </div>
            </div>
          )}
        </div>

        {err && <p className="px-5 pb-2 text-xs font-medium text-[var(--danger)]">{err}</p>}

        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button type="button" onClick={onClose} className="btn-secondary rounded-lg px-4 py-2 text-sm">
            关闭
          </button>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
            >
              <FiPlus className="h-4 w-4" />新建定时任务
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LockSummary({ material }: { material: Material }) {
  const lock = getMaterialLockFields(material);
  const coreLocks = [
    lock.forbidNewCharacters && "禁新增人物",
    lock.forbidNewEvents && "禁新增事件",
    lock.forbidChangeEnding && "禁改结局",
  ].filter(Boolean);

  return (
    <section className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3 text-sm">
      <p className="mb-2 font-semibold text-[var(--text-primary)]">入库锁配置（方案一 · 只读）</p>
      <div className="grid gap-1 text-[var(--text-secondary)]">
        <p>内容类型：{lock.contentType} · {formatSafetyLevelLabel(lock.contentType)} · 真实性锁 {lock.truthLock}%</p>
        <p>允许推测：{lock.allowSpeculation ? "是" : "否"} · 允许对白：{lock.allowDialogue ? "是" : "否"} · 允许虚构：{lock.allowFiction ? "是" : "否"}</p>
        {coreLocks.length > 0 && <p>核心锁：{coreLocks.join(" · ")}</p>}
      </div>
    </section>
  );
}

function DetailModal({
  m, busy, onClose, onAnalyze, onGenScript, onEvolve, onRewrite, rewriteBusyKey, deletingScriptId, onDeleteScript, onFav, onMark, onStoryboard, onStoryboardWithScript, onDelete,
}: {
  m: Material; busy: boolean; onClose: () => void;
  onAnalyze: () => void; onGenScript: () => void; onEvolve: () => void;
  onRewrite: (script: string, mode: ScriptRewriteMode, baseTitle: string) => void;
  rewriteBusyKey: string | null;
  deletingScriptId: string | null;
  onDeleteScript: (scriptId: string) => void;
  onFav: () => void;
  onMark: () => void;
  onStoryboard: () => void;
  onStoryboardWithScript: (scriptId: string) => void;
  onDelete: () => void;
}) {
  const a = m.analysis;
  const languageNote = formatMaterialLanguageNote(m.language);
  const lock = getMaterialLockFields(m);
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">{m.title}</h3>
              {languageNote && (
                <span className="shrink-0 rounded-full bg-[var(--bg-inset)] px-2 py-0.5 text-xs text-[var(--text-caption)]">
                  {languageNote}
                </span>
              )}
              <span className="shrink-0 rounded-full bg-[var(--bg-inset)] px-2 py-0.5 text-xs text-[var(--text-caption)]">
                {formatSafetyLevelLabel(lock.contentType)} · {lock.contentType}
              </span>
            </div>
            <p className="text-xs text-[var(--text-caption)]">
              {m.source} · {m.category} · {m.status}
            </p>
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

          <LockSummary material={m} />

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
                <div key={s.id} className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-[var(--text-caption)]">{s.title}</p>
                    <button
                      type="button"
                      disabled={busy || deletingScriptId !== null}
                      onClick={() => onDeleteScript(s.id)}
                      className="shrink-0 text-[var(--text-caption)] hover:text-[var(--danger)] disabled:opacity-50"
                      title="删除这条脚本"
                    >
                      {deletingScriptId === s.id ? (
                        <FiLoader className="h-4 w-4 animate-spin" />
                      ) : (
                        <FiTrash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mb-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">{s.script}</p>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onStoryboardWithScript(s.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      <FiPlay className="h-3 w-3" />
                      一键运行 AI 导演
                    </button>
                  </div>
                  <ScriptRewriteBar
                    materialId={m.id}
                    rewriteBusyKey={rewriteBusyKey}
                    disabled={busy}
                    onRewrite={(mode) => onRewrite(s.script, mode, s.title)}
                  />
                </div>
              ))}
            </section>
          )}
        </div>

        {/* 操作 */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-5 py-3">
          <button type="button" onClick={onEvolve} disabled={busy} className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50">
            {busy ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiTrendingUp className="h-4 w-4" />}
            {busy ? "进化中…" : "脚本进化"}
          </button>
          <button type="button" onClick={onGenScript} disabled={busy} className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm disabled:opacity-50">
            {busy ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiFileText className="h-4 w-4" />}快速生成
          </button>
          <button type="button" onClick={onStoryboard} className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
            <FiFilm className="h-4 w-4" />
            {m.scripts.length > 1 ? "选择脚本生成分镜" : "生成分镜（去创作中心）"}
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

function ScriptRewriteBar({
  materialId,
  rewriteBusyKey,
  disabled,
  onRewrite,
}: {
  materialId: string;
  rewriteBusyKey: string | null;
  disabled: boolean;
  onRewrite: (mode: ScriptRewriteMode) => void;
}) {
  return (
    <div className="border-t border-[var(--border)] pt-2">
      <p className="mb-1.5 text-xs text-[var(--text-caption)]">局部重写（保留素材锁规则）</p>
      <div className="flex flex-wrap gap-1.5">
        {SCRIPT_REWRITE_MODES.map((mode) => {
          const busy = rewriteBusyKey === `${materialId}:${mode.id}`;
          return (
            <button
              key={mode.id}
              type="button"
              disabled={disabled || rewriteBusyKey !== null}
              title={mode.hint}
              onClick={() => onRewrite(mode.id)}
              className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] disabled:opacity-50"
            >
              {busy ? <FiLoader className="inline h-3 w-3 animate-spin" /> : mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EvolutionSetupDialog({
  materialId,
  materialTitle,
  onClose,
  onStart,
}: {
  materialId: string;
  materialTitle: string;
  onClose: () => void;
  onStart: (durationMinutes: number) => void;
}) {
  const [duration, setDuration] = useState(8);
  const [custom, setCustom] = useState("");
  const [providerCount, setProviderCount] = useState(4);
  const [recommendations, setRecommendations] = useState<EvolutionRecommendation[]>([]);

  useEffect(() => {
    void fetch(
      `/api/materials/evolution/stats?materialId=${encodeURIComponent(materialId)}&durationMinutes=8`
    )
      .then((r) => r.json())
      .then(
        (data: {
          providers?: string[];
          recommendations?: EvolutionRecommendation[];
        }) => {
          const n = data.providers?.length ?? 0;
          if (n > 0) setProviderCount(n);
          if (data.recommendations?.length) setRecommendations(data.recommendations);
        }
      )
      .catch(() => {});
  }, [materialId]);
  const activeMinutes = custom.trim()
    ? Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, Number(custom) || duration))
    : duration;
  const plan = buildDurationPlan(activeMinutes);
  const meta = estimateEvolutionMeta(activeMinutes, providerCount);

  return (
    <div onClick={onClose} className="fixed inset-0 z-[54] flex items-center justify-center bg-black/60 p-6">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl bg-[var(--bg-surface)] p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">脚本进化 V2.0</h3>
            <p className="text-xs text-[var(--text-caption)] truncate max-w-[320px]">{materialTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--text-caption)] hover:text-[var(--text-primary)]">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-xs leading-relaxed text-[var(--text-caption)]">
          四模型随机风格生成大纲 → 大纲评分 → 前 2 名模型扩写长文 → 全员评分 → 冠亚军入库
        </p>

        {recommendations.length > 0 && (
          <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
            <p className="mb-1.5 text-xs font-semibold text-[var(--text-primary)]">智能推荐（基于历史数据）</p>
            {recommendations.map((rec, i) => (
              <p key={i} className="text-xs text-[var(--text-secondary)]">
                · {SCRIPT_PROVIDERS.find((p) => p.id === rec.provider)?.label ?? rec.provider} +{" "}
                {SCRIPT_STYLES.find((s) => s.id === rec.style)?.label ?? rec.style}
                <span className="text-[var(--text-caption)]"> — {rec.reason}</span>
              </p>
            ))}
          </div>
        )}

        <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">脚本时长</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {DURATION_PRESETS_MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setDuration(m);
                setCustom("");
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                !custom && duration === m
                  ? "border-[var(--accent)] bg-[var(--bg-inset)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text-secondary)]"
              }`}
            >
              {m} 分钟
            </button>
          ))}
        </div>
        <label className="mb-3 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          自定义（{MIN_DURATION_MINUTES}～{MAX_DURATION_MINUTES} 分钟，支持小数）
          <input
            type="number"
            min={MIN_DURATION_MINUTES}
            max={MAX_DURATION_MINUTES}
            step={0.1}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={String(duration)}
            className="input-field w-24 rounded-lg px-2 py-1.5 text-sm"
          />
        </label>

        <div className="mb-4 space-y-1 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3 text-xs text-[var(--text-secondary)]">
          <p>预计字数：<span className="font-medium text-[var(--text-primary)]">{plan.targetWordCount}</span> 字</p>
          <p>预计章节：<span className="font-medium text-[var(--text-primary)]">{plan.chapterCount}</span> 章</p>
          <p>故事结构：{plan.structureTemplate}</p>
          <p>生成数量：<span className="font-medium text-[var(--text-primary)]">{providerCount * 2}</span> 大纲 → 2 长文</p>
          <p>
            预计耗时：约 {meta.seconds} 秒 · API 成本：¥{meta.costMin}～{meta.costMax}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-[var(--text-caption)]">
          {["四模型随机风格", "多模型淘汰赛", "自动评分", "自动扩写", "冠亚军保存"].map((t) => (
            <span key={t} className="rounded-full border border-[var(--border)] px-2 py-0.5">
              ✓ {t}
            </span>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary rounded-lg px-4 py-2 text-sm">
            取消
          </button>
          <button
            type="button"
            onClick={() => onStart(activeMinutes)}
            className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <FiTrendingUp className="h-4 w-4" /> 开始脚本进化
          </button>
        </div>
      </div>
    </div>
  );
}

function EvolutionProgressModal({
  stage,
  candidateCount,
  outlineCount,
  roundCount,
}: {
  stage: string;
  candidateCount: number;
  outlineCount: number;
  roundCount: number;
}) {
  const providerHint =
    outlineCount > 0
      ? `大纲 ${outlineCount} 份${candidateCount > 0 ? ` · 长文 ${candidateCount} 篇` : ""}${roundCount > 0 ? ` · 阶段 ${roundCount}` : ""}`
      : "正在生成随机风格大纲…";

  return (
    <div className="fixed bottom-4 right-4 z-[55] w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-2xl">
      <div className="mb-2 flex items-center gap-2">
        <FiLoader className="h-4 w-4 animate-spin text-[var(--accent)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">脚本进化 V2 进行中</h3>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">{stage}</p>
      <p className="mt-1 text-[11px] text-[var(--text-caption)]">{providerHint}</p>
      <p className="mt-2 text-[11px] text-[var(--text-caption)]">
        约 1～5 分钟，后台进行，可继续操作。完成后自动弹结果；切到别的中心结果仍会存进素材，只是不再弹窗。
      </p>
    </div>
  );
}

function styleLabel(style: string): string {
  return SCRIPT_STYLES.find((s) => s.id === style)?.label ?? style;
}

function EvolutionResultModal({ run, onClose }: { run: EvolutionRun; onClose: () => void }) {
  const champion = run.candidates.find((c) => c.id === run.championId);
  const runnerUp = run.runnerUpId ? run.candidates.find((c) => c.id === run.runnerUpId) : undefined;
  const rankedOutlines = [...(run.outlines ?? [])].sort(
    (a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0)
  );
  const rankedScripts = [...run.candidates].sort(
    (a, b) => (b.aggregatedScore ?? b.totalScore ?? 0) - (a.aggregatedScore ?? a.totalScore ?? 0)
  );

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">脚本进化 V2 结果</h3>
            <p className="text-xs text-[var(--text-caption)]">
              {run.durationMinutes} 分钟 · 约 {run.targetWordCount} 字 · {run.chapterCount} 章 ·
              大纲 {run.outlines?.length ?? 0} · 冠亚军已入库
              {run.usage
                ? ` · 实际 Token ${run.usage.totalTokens} · 成本 ¥${run.usage.totalCostCny}`
                : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--text-caption)] hover:text-[var(--text-primary)]"><FiX className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {champion && (
            <section className="rounded-lg border border-[var(--accent)] bg-[var(--bg-inset)] p-3">
              <p className="mb-1.5 text-sm font-semibold text-[var(--accent)]">
                冠军 · {champion.provider} · {styleLabel(champion.style)} · {champion.aggregatedScore ?? champion.totalScore ?? "—"} 分
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                {champion.script}
              </p>
            </section>
          )}

          {runnerUp && (
            <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3">
              <p className="mb-1.5 text-sm font-semibold text-[var(--text-primary)]">
                亚军 · {runnerUp.provider} · {styleLabel(runnerUp.style)} · {runnerUp.aggregatedScore ?? runnerUp.totalScore ?? "—"} 分
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                {runnerUp.script}
              </p>
            </section>
          )}

          {rankedOutlines.length > 0 && (
            <section>
              <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">大纲排行榜</p>
              <div className="space-y-2">
                {rankedOutlines.slice(0, 8).map((o, i) => (
                  <div key={o.id} className="rounded-lg border border-[var(--border)] p-2 text-xs">
                    <p className="mb-1 text-[var(--text-caption)]">
                      #{i + 1} · {o.provider} · {styleLabel(o.style)} · {o.totalScore ?? "—"} 分
                    </p>
                    <p className="line-clamp-3 whitespace-pre-wrap text-[var(--text-secondary)]">{o.outline}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">长文评分</p>
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full min-w-[520px] text-xs">
                <thead className="bg-[var(--bg-inset)] text-[var(--text-caption)]">
                  <tr>
                    <th className="px-2 py-1.5 text-left">模型/风格</th>
                    <th className="px-2 py-1.5">综合分</th>
                    <th className="px-2 py-1.5">时长匹配</th>
                    <th className="px-2 py-1.5">完播预测</th>
                    <th className="px-2 py-1.5">角色</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedScripts.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--border)]">
                      <td className="px-2 py-1.5 text-[var(--text-secondary)]">{c.provider} · {styleLabel(c.style)}</td>
                      <td className="px-2 py-1.5 text-center font-semibold text-[var(--accent)]">
                        {c.aggregatedScore ?? c.totalScore ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {c.judgeScores?.[0]?.scores.durationFit ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {c.judgeScores?.[0]?.scores.completionRatePredict ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center text-[var(--text-caption)]">
                        {c.id === run.championId ? "冠军" : c.id === run.runnerUpId ? "亚军" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="border-t border-[var(--border)] px-5 py-3 text-right">
          <button type="button" onClick={onClose} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium">关闭</button>
        </div>
      </div>
    </div>
  );
}

function StoryboardScriptPickDialog({
  material,
  onClose,
  onPick,
}: {
  material: Material;
  onClose: () => void;
  onPick: (script: { text: string; title: string; id: string }) => void;
}) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-[56] flex items-center justify-center bg-black/60 p-6">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl bg-[var(--bg-surface)] p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">选择脚本生成分镜</h3>
            <p className="text-xs text-[var(--text-caption)]">编导将基于所选脚本拆镜头，不再重新 AI 写稿</p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--text-caption)] hover:text-[var(--text-primary)]">
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {material.scripts.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick({ text: s.script, title: s.title, id: s.id })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3 text-left hover:border-[var(--accent)]"
            >
              <p className="mb-1 text-sm font-medium text-[var(--text-primary)]">{s.title}</p>
              <p className="line-clamp-3 text-xs text-[var(--text-secondary)]">{s.script}</p>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary rounded-lg px-4 py-2 text-sm">
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

function providerLabel(id: string): string {
  return SCRIPT_PROVIDERS.find((p) => p.id === id)?.label ?? id;
}

function EvolutionStatsDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"models" | "styles" | "scripts">("models");
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelPerformanceEntry[]>([]);
  const [styles, setStyles] = useState<StylePerformanceEntry[]>([]);
  const [records, setRecords] = useState<ScriptRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [humanScore, setHumanScore] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/materials/evolution/stats");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setModels(data.models ?? []);
      setStyles(data.styles ?? []);
      setRecords(data.recentScripts ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveRecord(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/materials/evolution/records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setEditingId(null);
      await refresh();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[58] flex items-center justify-center bg-black/70 p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">脚本进化数据库</h3>
            <p className="text-xs text-[var(--text-caption)]">模型 / 风格胜率 · 脚本归档 · 发布与 YouTube 数据回写</p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--text-caption)] hover:text-[var(--text-primary)]">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-[var(--border)] px-5 py-2">
          {(
            [
              ["models", "模型表现"],
              ["styles", "风格表现"],
              ["scripts", "脚本记录"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tab === id
                  ? "bg-[var(--bg-inset)] font-semibold text-[var(--accent)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-[var(--text-caption)]">
              <FiLoader className="h-4 w-4 animate-spin" /> 加载中…
            </p>
          ) : tab === "models" ? (
            models.length === 0 ? (
              <p className="text-sm text-[var(--text-caption)]">暂无数据，先跑一次脚本进化。</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-[var(--text-caption)]">
                  <tr>
                    <th className="py-1 text-left">模型</th>
                    <th className="py-1">大纲均分</th>
                    <th className="py-1">长文均分</th>
                    <th className="py-1">胜率</th>
                    <th className="py-1">冠军</th>
                    <th className="py-1">亚军</th>
                    <th className="py-1">均 Token</th>
                    <th className="py-1">均成本$</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr key={m.provider} className="border-t border-[var(--border)]">
                      <td className="py-1.5">{providerLabel(m.provider)}</td>
                      <td className="py-1.5 text-center">{m.outlineAvg || "—"}</td>
                      <td className="py-1.5 text-center">{m.fullAvg || "—"}</td>
                      <td className="py-1.5 text-center font-semibold text-[var(--accent)]">{m.winRate}%</td>
                      <td className="py-1.5 text-center">{m.championCount}</td>
                      <td className="py-1.5 text-center">{m.runnerUpCount}</td>
                      <td className="py-1.5 text-center">{m.avgTokens || "—"}</td>
                      <td className="py-1.5 text-center">{m.avgCostUsd || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : tab === "styles" ? (
            styles.length === 0 ? (
              <p className="text-sm text-[var(--text-caption)]">暂无风格统计。</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-[var(--text-caption)]">
                  <tr>
                    <th className="py-1 text-left">风格</th>
                    <th className="py-1">使用</th>
                    <th className="py-1">大纲均分</th>
                    <th className="py-1">长文均分</th>
                    <th className="py-1">胜率</th>
                    <th className="py-1">最佳模型</th>
                  </tr>
                </thead>
                <tbody>
                  {styles.map((s) => (
                    <tr key={s.style} className="border-t border-[var(--border)]">
                      <td className="py-1.5">{styleLabel(s.style)}</td>
                      <td className="py-1.5 text-center">{s.useCount}</td>
                      <td className="py-1.5 text-center">{s.outlineAvg || "—"}</td>
                      <td className="py-1.5 text-center">{s.fullAvg || "—"}</td>
                      <td className="py-1.5 text-center font-semibold text-[var(--accent)]">{s.winRate}%</td>
                      <td className="py-1.5 text-center">{s.bestProvider ? providerLabel(s.bestProvider) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : records.length === 0 ? (
            <p className="text-sm text-[var(--text-caption)]">暂无脚本记录。</p>
          ) : (
            <div className="space-y-3">
              {records.map((r) => (
                <div key={r.id} className="rounded-lg border border-[var(--border)] p-3 text-xs">
                  <p className="mb-1 font-medium text-[var(--text-primary)]">
                    {r.materialTitle} · {r.role === "champion" ? "冠军" : r.role === "runner-up" ? "亚军" : r.role}
                    {" · "}
                    {providerLabel(r.provider)} / {styleLabel(r.style)} · {r.durationMinutes}分钟 · {r.actualWordCount}字
                  </p>
                  <p className="mb-2 text-[var(--text-caption)]">
                    评分 {r.aggregatedScore ?? "—"} · Token {r.inputTokens + r.outputTokens} · ¥{r.costCny}
                    {r.published ? " · 已发布" : ""}
                  </p>
                  {editingId === r.id ? (
                    <div className="space-y-2">
                      <input
                        className="input-field w-full rounded-lg px-2 py-1.5 text-xs"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="YouTube 视频链接"
                      />
                      <input
                        className="input-field w-24 rounded-lg px-2 py-1.5 text-xs"
                        value={humanScore}
                        onChange={(e) => setHumanScore(e.target.value)}
                        placeholder="人工评分 0-100"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void saveRecord(r.id, {
                              videoUrl,
                              published: Boolean(videoUrl.trim()),
                              humanScore: humanScore ? Number(humanScore) : undefined,
                            })
                          }
                          className="btn-primary rounded-md px-2 py-1 text-xs"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="btn-secondary rounded-md px-2 py-1 text-xs"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {r.videoUrl && (
                        <a
                          href={r.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--accent)] hover:underline"
                        >
                          视频链接
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(r.id);
                          setVideoUrl(r.videoUrl ?? "");
                          setHumanScore(r.humanScore != null ? String(r.humanScore) : "");
                        }}
                        className="text-[var(--text-secondary)] hover:text-[var(--accent)]"
                      >
                        编辑发布信息
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border)] px-5 py-3 text-right">
          <button type="button" onClick={onClose} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
