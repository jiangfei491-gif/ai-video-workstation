"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiPause,
  FiPlay,
  FiPlus,
  FiRefreshCw,
  FiRotateCw,
  FiCopy,
  FiTrash2,
  FiX,
  FiZap,
} from "react-icons/fi";
import { statusStyle, LIBRARIES } from "./crawler-status";

type CrawlerTask = {
  id: string;
  source_id: string;
  status: string;
  progress?: Record<string, unknown>;
  queue_position: number | null;
  pages_done: number;
  pages_total: number | null;
  items_found: number;
  error_message: string | null;
  started_at: string | null;
  created_at: string;
};

type Source = {
  id: string;
  name: string;
  provider_slug: string;
  supports_crawler: boolean;
  enabled: boolean;
};

type Schedule = {
  source_id: string;
  crawl_mode: string;
  frequency: string;
  crawl_times: string[];
  max_items: number;
  scan_mode: string;
  next_run_at: string | null;
  last_run_at: string | null;
  enabled: boolean;
  metadata?: { groupId?: string; groupName?: string; groupSize?: number; platforms?: string[] };
};

type ScheduleGroup = {
  key: string;
  name: string;
  sourceIds: string[];
  frequency: string;
  crawl_times: string[];
  max_items: number;
  next_run_at: string | null;
  last_run_at: string | null;
};

const FREQ_LABEL: Record<string, string> = {
  hourly: "每小时",
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
  custom: "自定义",
};

type ScanMode = "new_only" | "full_rescan" | "incremental";

const TIMEOUT_OPTIONS = [
  { v: 60, l: "1 分钟" },
  { v: 180, l: "3 分钟" },
  { v: 300, l: "5 分钟" },
  { v: 600, l: "10 分钟" },
  { v: 1800, l: "30 分钟" },
];
const SCAN_MODES: { v: ScanMode; l: string }[] = [
  { v: "new_only", l: "仅新增" },
  { v: "incremental", l: "增量续抓" },
  { v: "full_rescan", l: "全量重扫" },
];
const AI_OPTIONS = ["AI分析", "AI摘要", "AI翻译", "AI评分", "AI去重", "自动标签"];
const INGEST_STRATEGY = [
  { id: "auto", l: "AI 自动分类" },
  { id: "main-linked", l: "主库 + 关联" },
  { id: "all", l: "全部保存" },
];

export default function CrawlerTasksPanel() {
  const [tasks, setTasks] = useState<CrawlerTask[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [aiAnalyzed, setAiAnalyzed] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; taskId: string } | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<"tasks" | "scheduled">("tasks");
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const loadSchedules = useCallback(async () => {
    try {
      const d = await fetch("/api/resource-center/scheduler").then((r) => r.json());
      setSchedules(((d.schedules ?? []) as Schedule[]).filter((s) => s.crawl_mode === "auto"));
    } catch {
      setSchedules([]);
    }
  }, []);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    void opts;
    const [tr, sr] = await Promise.all([
      fetch("/api/resource-center/crawler/tasks").then((r) => r.json()).catch(() => ({ tasks: [] })),
      fetch("/api/resource-center/sources").then((r) => r.json()).catch(() => ({ sources: [] })),
    ]);
    setTasks((tr.tasks ?? []) as CrawlerTask[]);
    setSources((sr.sources ?? []) as Source[]);
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const d = await fetch("/api/resource-center").then((r) => r.json());
      const gs = (d?.globalStats ?? {}) as Record<string, number>;
      // 已入库资源都经过 AI 分析（有分类/标签/评分），用它作「AI分析」数
      const n = gs.analyzed ?? gs.totalResources ?? null;
      setAiAnalyzed(typeof n === "number" ? n : null);
    } catch {
      setAiAnalyzed(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void loadOverview();
    void loadSchedules();
    const t = setInterval(() => void refresh({ silent: true }), 5000);
    return () => clearInterval(t);
  }, [refresh, loadOverview, loadSchedules]);

  async function cancelSchedule(sourceIds: string[]) {
    await Promise.all(
      sourceIds.map((id) =>
        fetch(`/api/resource-center/scheduler/sources/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ crawlMode: "manual" }),
        })
      )
    );
    await loadSchedules();
  }

  async function runScheduleNow(sourceIds: string[]) {
    await Promise.all(
      sourceIds.map((id) =>
        fetch(`/api/resource-center/scheduler/sources/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync_now" }),
        })
      )
    );
    setView("tasks");
    await refresh();
  }

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const sourceName = useMemo(() => {
    const m = new Map(sources.map((s) => [s.id, s.name]));
    return (id: string) => m.get(id) ?? "未知来源（已删除）";
  }, [sources]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      platforms: sources.filter((s) => s.supports_crawler).length,
      tasks: tasks.length,
      running: tasks.filter((t) => t.status === "running").length,
      pending: tasks.filter((t) => t.status === "pending" || t.status === "queued").length,
      todayNew: tasks
        .filter((t) => (t.created_at ?? "").slice(0, 10) === today)
        .reduce((a, t) => a + (t.items_found ?? 0), 0),
      failed: tasks.filter((t) => t.status === "failed").length,
    };
  }, [tasks, sources]);

  const selected = useMemo(() => tasks.find((t) => t.id === selectedId) ?? null, [tasks, selectedId]);

  const filteredTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    switch (filter) {
      case "running": return tasks.filter((t) => t.status === "running");
      case "pending": return tasks.filter((t) => t.status === "pending" || t.status === "queued");
      case "failed": return tasks.filter((t) => t.status === "failed");
      case "today": return tasks.filter((t) => (t.created_at ?? "").slice(0, 10) === today);
      default: return tasks;
    }
  }, [tasks, filter]);

  const scheduleGroups = useMemo<ScheduleGroup[]>(() => {
    const groups = new Map<string, ScheduleGroup>();
    for (const s of schedules) {
      const gid = s.metadata?.groupId ?? s.source_id;
      const existing = groups.get(gid);
      if (existing) {
        existing.sourceIds.push(s.source_id);
      } else {
        groups.set(gid, {
          key: gid,
          name: s.metadata?.groupName ?? sourceName(s.source_id),
          sourceIds: [s.source_id],
          frequency: s.frequency,
          crawl_times: s.crawl_times,
          max_items: s.max_items,
          next_run_at: s.next_run_at,
          last_run_at: s.last_run_at,
        });
      }
    }
    return [...groups.values()];
  }, [schedules, sourceName]);

  async function action(id: string, op: string) {
    await fetch(`/api/resource-center/crawler/tasks/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: op }),
    });
    await refresh();
  }

  async function del(id: string) {
    await fetch(`/api/resource-center/crawler/tasks/${id}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId(null);
    await refresh();
  }

  async function bulk(op: "resume" | "pause", filter: (t: CrawlerTask) => boolean) {
    await Promise.all(tasks.filter(filter).map((t) => action(t.id, op)));
  }

  async function copyTask(t: CrawlerTask) {
    await fetch("/api/resource-center/crawler/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: t.source_id }),
    });
    await refresh();
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* ===== 顶部 Dashboard ===== */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <StatCard label="平台" value={stats.platforms} onClick={() => setFilter("all")} active={filter === "all"} />
          <StatCard label="任务" value={stats.tasks} onClick={() => setFilter("all")} active={filter === "all"} />
          <StatCard label="运行中" value={stats.running} tone="#3b82f6" onClick={() => setFilter("running")} active={filter === "running"} />
          <StatCard label="等待中" value={stats.pending} tone="#94a3b8" onClick={() => setFilter("pending")} active={filter === "pending"} />
          <StatCard label="今日新增" value={stats.todayNew} onClick={() => setFilter("today")} active={filter === "today"} />
          <StatCard label="AI分析" value={aiAnalyzed ?? "—"} onClick={() => setFilter("all")} active={false} />
          <StatCard label="失败" value={stats.failed} tone={stats.failed ? "#ef4444" : undefined} onClick={() => setFilter("failed")} active={filter === "failed"} />
        </div>
      </div>
      {toast && (
        <div className="flex items-center justify-between rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-xs text-[var(--text-secondary)]">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="text-[var(--text-caption)]"><FiX /></button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <ActionBtn primary onClick={() => { setFilter("all"); setDrawerOpen(true); }}><FiPlus /> 新建任务</ActionBtn>
        <ActionBtn onClick={() => void bulk("resume", (t) => t.status === "paused" || t.status === "pending")}><FiPlay /> 全部开始</ActionBtn>
        <ActionBtn onClick={() => void bulk("pause", (t) => t.status === "running")}><FiPause /> 全部暂停</ActionBtn>
        <ActionBtn onClick={() => void bulk("resume", (t) => t.status === "failed")}><FiRotateCw /> 恢复失败</ActionBtn>
        <ActionBtn onClick={() => void refresh()}><FiRefreshCw /> 刷新</ActionBtn>
      </div>

      {/* ===== 中部：任务列表 + 详情 ===== */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* 左：任务卡 / 定时任务 */}
        <div className="min-h-0 overflow-y-auto pr-1">
          {/* 视图切换 */}
          <div className="mb-3 inline-flex rounded-lg border border-[var(--border)] p-0.5 text-xs">
            <button type="button" onClick={() => setView("tasks")}
              className={`rounded-md px-3 py-1 ${view === "tasks" ? "bg-[var(--accent)] text-white" : "text-[var(--text-caption)]"}`}>
              抓取任务
            </button>
            <button type="button" onClick={() => { setView("scheduled"); void loadSchedules(); }}
              className={`rounded-md px-3 py-1 ${view === "scheduled" ? "bg-[var(--accent)] text-white" : "text-[var(--text-caption)]"}`}>
              定时任务（{scheduleGroups.length}）
            </button>
          </div>

          {view === "scheduled" ? (
            scheduleGroups.length === 0 ? (
              <p className="text-sm text-[var(--text-caption)]">
                暂无定时任务。点「新建任务」→ 选「定时」即可设置，会显示在这里。
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {scheduleGroups.map((g) => (
                  <ScheduleCard
                    key={g.key}
                    group={g}
                    platformNames={g.sourceIds.map((id) => sourceName(id))}
                    onRunNow={() => void runScheduleNow(g.sourceIds)}
                    onCancel={() => void cancelSchedule(g.sourceIds)}
                  />
                ))}
              </div>
            )
          ) : (
          <>
          {filter !== "all" && (
            <button type="button" onClick={() => setFilter("all")} className="mb-2 text-xs text-[var(--accent)]">
              已筛选（{filteredTasks.length}）· 点此清除
            </button>
          )}
          {filteredTasks.length === 0 ? (
            <p className="text-sm text-[var(--text-caption)]">
              {filter === "all" ? "暂无任务，点「新建任务」开始。" : "该筛选下暂无任务。"}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  name={sourceName(t.source_id)}
                  selected={t.id === selectedId}
                  onClick={() => setSelectedId(t.id)}
                  onContext={(e) => {
                    e.preventDefault();
                    setSelectedId(t.id);
                    setMenu({ x: e.clientX, y: e.clientY, taskId: t.id });
                  }}
                />
              ))}
            </div>
          )}
          </>
          )}
        </div>

        {/* 右：详情 */}
        <div className="min-h-0 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          {selected ? (
            <TaskDetail task={selected} name={sourceName(selected.source_id)} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-caption)]">
              点击左侧任务查看详情
            </div>
          )}
        </div>
      </div>

      {/* ===== 底部：执行队列 ===== */}
      <div className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-4 py-2.5">
        <div className="flex items-center gap-3 overflow-x-auto text-xs">
          <span className="shrink-0 font-medium text-[var(--text-secondary)]">执行队列</span>
          {tasks.filter((t) => ["running", "pending", "queued"].includes(t.status)).length === 0 ? (
            <span className="text-[var(--text-caption)]">空闲</span>
          ) : (
            tasks
              .filter((t) => ["running", "pending", "queued"].includes(t.status))
              .map((t) => {
                const st = statusStyle(t.status);
                return (
                  <span key={t.id} className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
                    <span className="text-[var(--text-secondary)]">{sourceName(t.source_id).slice(0, 10)}</span>
                    <span className="text-[var(--text-caption)]">{t.items_found}项</span>
                  </span>
                );
              })
          )}
        </div>
      </div>

      {/* ===== 右键菜单 ===== */}
      {menu && (
        <div
          className="fixed z-50 min-w-[128px] rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-1 text-sm shadow-xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem onClick={() => { void action(menu.taskId, "pause"); setMenu(null); }}><FiPause /> 暂停</MenuItem>
          <MenuItem onClick={() => { void action(menu.taskId, "resume"); setMenu(null); }}><FiPlay /> 继续</MenuItem>
          <MenuItem onClick={() => { void action(menu.taskId, "retry"); setMenu(null); }}><FiZap /> 立即运行</MenuItem>
          <MenuItem onClick={() => { const t = tasks.find((x) => x.id === menu.taskId); if (t) void copyTask(t); setMenu(null); }}><FiCopy /> 复制</MenuItem>
          <MenuItem danger onClick={() => { void del(menu.taskId); setMenu(null); }}><FiTrash2 /> 删除</MenuItem>
        </div>
      )}

      {/* ===== 新建任务抽屉 ===== */}
      {drawerOpen && (
        <NewTaskDrawer
          sources={sources.filter((s) => s.supports_crawler && s.enabled)}
          onClose={() => setDrawerOpen(false)}
          onCreated={(mode) => {
            setDrawerOpen(false);
            setFilter("all");
            void refresh();
            if (mode === "scheduled") {
              void loadSchedules();
              setView("scheduled");
              setToast("已设为定时任务，在下方「定时任务」里查看，到点自动运行");
            } else {
              setView("tasks");
              setToast(null);
            }
          }}
        />
      )}
    </div>
  );
}

/* ---------- 子组件 ---------- */

function StatCard({
  label,
  value,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: number | string;
  tone?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border bg-[var(--bg-surface)] px-3 py-2.5 text-left transition-colors hover:border-[var(--accent)]/50 ${
        active ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/30" : "border-[var(--border)]"
      }`}
    >
      <div className="text-lg font-semibold leading-tight" style={tone ? { color: tone } : { color: "var(--text-primary)" }}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-[var(--text-caption)]">{label}</div>
    </button>
  );
}

function ActionBtn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        primary
          ? "bg-[var(--accent)] text-white hover:opacity-90"
          : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
      }`}
    >
      {children}
    </button>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--bg-surface-hover)] ${
        danger ? "text-[#ef4444]" : "text-[var(--text-secondary)]"
      }`}
    >
      {children}
    </button>
  );
}

function TaskCard({
  task,
  name,
  selected,
  onClick,
  onContext,
}: {
  task: CrawlerTask;
  name: string;
  selected: boolean;
  onClick: () => void;
  onContext: (e: React.MouseEvent) => void;
}) {
  const st = statusStyle(task.status);
  const pct =
    task.pages_total && task.pages_total > 0
      ? Math.min(100, Math.round((task.pages_done / task.pages_total) * 100))
      : task.status === "completed"
        ? 100
        : task.status === "running"
          ? 40
          : 0;
  return (
    <div
      onClick={onClick}
      onDoubleClick={onClick}
      onContextMenu={onContext}
      className={`cursor-pointer rounded-xl border bg-[var(--bg-surface)] p-3.5 transition-all hover:border-[var(--accent)]/50 hover:shadow-sm ${
        selected ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/30" : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--text-primary)]">{name} · 抓取任务</p>
          <p className="mt-0.5 truncate text-xs text-[var(--text-caption)]">
            新建于 {new Date(task.created_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full ${st.chipBg} px-2 py-0.5 text-xs ${st.text}`}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
          {st.label}
        </span>
      </div>

      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-inset)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: st.bar }} />
      </div>
      <div className="mt-1 text-right text-xs text-[var(--text-caption)]">{pct}%</div>

      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
        <Metric label="新增" value={task.items_found} tone="#22c55e" />
        <Metric label="页数" value={task.pages_done} />
        <Metric label="失败" value={task.status === "failed" ? 1 : 0} tone={task.status === "failed" ? "#ef4444" : undefined} />
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div>
      <div className="text-sm font-semibold" style={tone ? { color: tone } : { color: "var(--text-primary)" }}>{value}</div>
      <div className="text-[11px] text-[var(--text-caption)]">{label}</div>
    </div>
  );
}

function ScheduleCard({
  group,
  platformNames,
  onRunNow,
  onCancel,
}: {
  group: ScheduleGroup;
  platformNames: string[];
  onRunNow: () => void;
  onCancel: () => void;
}) {
  const next = group.next_run_at ? new Date(group.next_run_at).toLocaleString("zh-CN") : "—";
  const last = group.last_run_at ? new Date(group.last_run_at).toLocaleString("zh-CN") : "从未";
  const multi = platformNames.length > 1;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{group.name}</p>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#3b82f6]/12 px-2 py-0.5 text-xs text-[#3b82f6]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#3b82f6" }} />定时
        </span>
      </div>
      {multi && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {platformNames.map((p, i) => (
            <span key={i} className="rounded bg-[var(--bg-inset)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]">{p}</span>
          ))}
        </div>
      )}
      <div className="mt-2 space-y-1 text-xs text-[var(--text-caption)]">
        <div>频率：{FREQ_LABEL[group.frequency] ?? group.frequency} {group.crawl_times?.join("/") || ""}
          {multi && ` · ${platformNames.length} 个平台`}</div>
        <div>下次执行：<span className="text-[var(--text-secondary)]">{next}</span></div>
        <div>上次执行：{last} · 每平台 {group.max_items ? `${group.max_items} 条` : "不限"}</div>
      </div>
      <div className="mt-2.5 flex gap-2">
        <button type="button" onClick={onRunNow}
          className="flex-1 rounded-lg bg-[var(--accent)] px-2 py-1.5 text-xs text-white hover:opacity-90">
          <FiZap className="mr-1 inline" />立即运行{multi ? "（全部）" : ""}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text-caption)] hover:text-[#ef4444]">
          取消定时
        </button>
      </div>
    </div>
  );
}

function TaskDetail({ task, name }: { task: CrawlerTask; name: string }) {
  const opts = (task.progress?.options ?? {}) as { maxItems?: number; timeoutSec?: number; scanMode?: string };
  const [ai, setAi] = useState<Record<string, boolean>>({ AI分析: true, AI去重: true });
  const [libs, setLibs] = useState<Set<string>>(new Set());
  const [strategy, setStrategy] = useState("auto");
  const st = statusStyle(task.status);
  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{name}</h3>
        <span className={`inline-flex items-center gap-1 rounded-full ${st.chipBg} px-2 py-0.5 text-xs ${st.text}`}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />{st.label}
        </span>
      </div>

      <Section title="基础信息">
        <Row k="任务名称" v={`${name} · 抓取任务`} />
        <Row k="来源平台" v={name} />
        <Row k="创建时间" v={new Date(task.created_at).toLocaleString("zh-CN")} />
        <Row k="已发现" v={`${task.items_found} 项`} />
      </Section>

      <Section title="抓取配置">
        <Row k="抓取模式" v={SCAN_MODES.find((s) => s.v === opts.scanMode)?.l ?? "仅新增"} />
        <Row k="每次数量" v={opts.maxItems ? `${opts.maxItems} 条` : "不限"} />
        <Row k="超时时间" v={TIMEOUT_OPTIONS.find((t) => t.v === opts.timeoutSec)?.l ?? `${opts.timeoutSec ?? 300}s`} />
        <Row k="页 / 进度" v={`${task.pages_done}/${task.pages_total ?? "?"}`} />
      </Section>

      <Section title="AI 处理">
        <div className="flex flex-wrap gap-2">
          {AI_OPTIONS.map((o) => (
            <Toggle key={o} label={o} on={!!ai[o]} onToggle={() => setAi((p) => ({ ...p, [o]: !p[o] }))} />
          ))}
        </div>
      </Section>

      <Section title="入库配置">
        <div className="grid grid-cols-2 gap-1.5">
          {LIBRARIES.map((l) => (
            <label key={l.id} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={libs.has(l.id)}
                onChange={() => setLibs((p) => { const n = new Set(p); n.has(l.id) ? n.delete(l.id) : n.add(l.id); return n; })}
              />
              {l.label}
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {INGEST_STRATEGY.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStrategy(s.id)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${
                strategy === s.id ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-caption)]"
              }`}
            >
              {s.l}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[var(--text-caption)]">
          注：AI 处理与入库策略为界面配置项，抓取仍按当前后端逻辑执行。
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-caption)]">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-[var(--text-caption)]">{k}</span>
      <span className="truncate text-right text-[var(--text-secondary)]">{v}</span>
    </div>
  );
}

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
        on ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-caption)]"
      }`}
    >
      {label}
    </button>
  );
}

const FREQ_OPTIONS: { v: string; l: string }[] = [
  { v: "hourly", l: "每小时" },
  { v: "daily", l: "每天" },
  { v: "weekly", l: "每周" },
  { v: "monthly", l: "每月" },
];
const COUNT_PRESETS = [10, 50, 100, 500, 1000, 0];

/** 客户端估算下次执行时间（与后端 computeNextRunAt 一致），用于抽屉预览 */
function estimateNextRun(freq: string, time: string): Date {
  const [h, m] = time.split(":").map((x) => Number(x) || 0);
  const now = new Date();
  const d = new Date(now);
  if (freq === "hourly") {
    d.setMinutes(m, 0, 0);
    if (d <= now) d.setHours(d.getHours() + 1);
  } else if (freq === "weekly") {
    d.setHours(h, m, 0, 0);
    const add = ((7 - d.getDay()) % 7) || 7;
    if (d > now && d.getDay() === now.getDay()) {
      /* 今天稍后 */
    } else {
      d.setDate(d.getDate() + add);
    }
  } else if (freq === "monthly") {
    d.setHours(h, m, 0, 0);
    if (d <= now) d.setMonth(d.getMonth() + 1, 1);
  } else {
    // daily
    d.setHours(h, m, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
  }
  return d;
}

function NewTaskDrawer({
  sources,
  onClose,
  onCreated,
}: {
  sources: Source[];
  onClose: () => void;
  onCreated: (mode: "once" | "scheduled") => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set(sources[0] ? [sources[0].id] : []));
  const [crawlMode, setCrawlMode] = useState<"once" | "scheduled">("once");
  const [freq, setFreq] = useState("daily");
  const [time, setTime] = useState("02:00");
  const [countMode, setCountMode] = useState<"each" | "total">("each");
  const [count, setCount] = useState(100);
  const [timeoutSec, setTimeoutSec] = useState(300);
  const [scanMode, setScanMode] = useState<ScanMode>("new_only");
  const [libs, setLibs] = useState<Set<string>>(new Set());
  const [autoClassify, setAutoClassify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 每个平台实际抓取条数：total 模式按平台数平摊
  const perPlatform =
    count === 0 ? 0 : countMode === "total" ? Math.max(1, Math.ceil(count / Math.max(1, picked.size))) : count;

  async function start() {
    if (picked.size === 0) { setErr("请选择至少一个平台"); return; }
    setBusy(true);
    setErr(null);
    try {
      let results: { error?: string }[];
      if (crawlMode === "scheduled") {
        // 定时：同一次创建的多平台共用一个组 id，视图里合并为一条
        const groupId = (crypto.randomUUID?.() ?? String(Date.now()));
        const platformNames = sources.filter((s) => picked.has(s.id)).map((s) => s.name);
        const groupName = picked.size > 1 ? `多平台定时 · ${picked.size} 个` : platformNames[0] ?? "定时任务";
        results = await Promise.all(
          [...picked].map((id) =>
            fetch(`/api/resource-center/scheduler/sources/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                enabled: true,
                crawlMode: "auto",
                frequency: freq,
                crawlTimes: [time],
                maxItems: perPlatform,
                scanMode,
                metadata: { groupId, groupName, groupSize: picked.size, platforms: platformNames },
              }),
            }).then((r) => r.json())
          )
        );
      } else {
        // 一次：立即建抓取任务
        results = await Promise.all(
          [...picked].map((source_id) =>
            fetch("/api/resource-center/crawler/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ source_id, maxItems: perPlatform, timeoutSec, scanMode }),
            }).then((r) => r.json())
          )
        );
      }
      const bad = results.find((r) => r.error);
      if (bad) setErr(bad.error ?? "操作失败");
      else onCreated(crawlMode);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">新建抓取任务</h3>
          <button type="button" onClick={onClose} className="text-[var(--text-caption)] hover:text-[var(--text-primary)]"><FiX /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">来源平台（可多选）</span>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2">
              {sources.length === 0 && <p className="text-xs text-[var(--text-caption)]">无可用平台</p>}
              {sources.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input type="checkbox" checked={picked.has(s.id)}
                    onChange={() => setPicked((p) => { const n = new Set(p); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })} />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          {/* 抓取模式：一次 / 定时 */}
          <Field label="抓取模式">
            <div className="flex gap-2">
              <ModeBtn on={crawlMode === "once"} onClick={() => setCrawlMode("once")}>一次</ModeBtn>
              <ModeBtn on={crawlMode === "scheduled"} onClick={() => setCrawlMode("scheduled")}>定时</ModeBtn>
            </div>
          </Field>

          {crawlMode === "scheduled" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="频率">
                  <select value={freq} onChange={(e) => setFreq(e.target.value)} className={selectCls}>
                    {FREQ_OPTIONS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
                  </select>
                </Field>
                <Field label={freq === "hourly" ? "整点分钟" : "时间"}>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={selectCls} />
                </Field>
              </div>
              <p className="-mt-2 rounded-lg bg-[var(--accent)]/10 px-3 py-2 text-xs text-[var(--text-secondary)]">
                下次执行约：<span className="font-medium text-[var(--accent)]">{estimateNextRun(freq, time).toLocaleString("zh-CN")}</span>
                {freq === "hourly" && "（之后每小时一次）"}
                {freq === "daily" && "（之后每天一次）"}
              </p>
            </>
          )}

          {/* 抓多少条：各平台 / 共 + 可调 */}
          <Field label="抓多少条">
            <div className="mb-2 flex gap-2">
              <ModeBtn on={countMode === "each"} onClick={() => setCountMode("each")}>各平台</ModeBtn>
              <ModeBtn on={countMode === "total"} onClick={() => setCountMode("total")}>共（平摊）</ModeBtn>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min={0} value={count}
                onChange={(e) => setCount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className={`${selectCls} w-28`} />
              <span className="text-xs text-[var(--text-caption)]">条（0=不限）</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COUNT_PRESETS.map((v) => (
                <button key={v} type="button" onClick={() => setCount(v)}
                  className={`rounded-md border px-2 py-0.5 text-xs ${count === v ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-caption)]"}`}>
                  {v === 0 ? "不限" : v}
                </button>
              ))}
            </div>
            {picked.size > 1 && count > 0 && (
              <p className="mt-1.5 text-[11px] text-[var(--text-caption)]">
                {countMode === "each"
                  ? `每个平台各 ${count} 条，共约 ${count * picked.size} 条`
                  : `共 ${count} 条，平摊到 ${picked.size} 个平台，每个约 ${perPlatform} 条`}
              </p>
            )}
          </Field>

          {crawlMode === "once" && (
            <Field label="抓多久（超时上限）">
              <select value={timeoutSec} onChange={(e) => setTimeoutSec(Number(e.target.value))} className={selectCls}>
                {TIMEOUT_OPTIONS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
          )}

          <Field label="怎么抓">
            <div className="flex gap-2">
              {SCAN_MODES.map((m) => (
                <button key={m.v} type="button" onClick={() => setScanMode(m.v)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs ${scanMode === m.v ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-caption)]"}`}>
                  {m.l}
                </button>
              ))}
            </div>
          </Field>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">入库素材库（可多选）</span>
            <div className="grid grid-cols-2 gap-1.5">
              {LIBRARIES.map((l) => (
                <label key={l.id} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input type="checkbox" checked={libs.has(l.id)}
                    onChange={() => setLibs((p) => { const n = new Set(p); n.has(l.id) ? n.delete(l.id) : n.add(l.id); return n; })} />
                  {l.label}
                </label>
              ))}
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <input type="checkbox" checked={autoClassify} onChange={() => setAutoClassify((v) => !v)} /> AI 自动分类入库
            </label>
          </div>

          {err && <p className="text-xs text-[#ef4444]">{err}</p>}
        </div>

        <div className="border-t border-[var(--border)] px-5 py-4">
          <button type="button" disabled={busy || picked.size === 0} onClick={() => void start()}
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50">
            <FiZap className="mr-1 inline" />
            {busy ? "处理中…" : crawlMode === "scheduled" ? `设为定时（${picked.size} 个平台）` : `开始抓取（${picked.size} 个平台）`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeBtn({ children, on, onClick }: { children: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
        on ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-caption)]"
      }`}>
      {children}
    </button>
  );
}

const selectCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-sm text-[var(--text-primary)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}
