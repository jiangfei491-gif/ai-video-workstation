"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FiGithub,
  FiBox,
  FiFileText,
  FiRss,
  FiCpu,
  FiLink,
  FiVideo,
  FiPackage,
  FiDatabase,
  FiSettings,
  FiClock,
  FiActivity,
  FiCheckSquare,
  FiTrendingUp,
} from "react-icons/fi";
import { IC_PLATFORMS } from "@/app/lib/intelligence-center/platforms";
import { IC_SUBMODULES, IC_STATUS_LABEL, type IcPlatformId, type IcStatus, type IcSubModule } from "@/app/lib/intelligence-center/types";

const PLATFORM_ICON: Record<IcPlatformId, React.ComponentType<{ className?: string }>> = {
  github: FiGithub,
  huggingface: FiBox,
  modelscope: FiDatabase,
  pypi: FiPackage,
  npm: FiPackage,
  arxiv: FiFileText,
  "ai-news": FiRss,
  comfyui: FiCpu,
  mcp: FiLink,
  "ai-video": FiVideo,
};

const SUBMODULE_ICON: Record<IcSubModule, React.ComponentType<{ className?: string }>> = {
  sources: FiDatabase,
  analyzer: FiActivity,
  advisor: FiTrendingUp,
  review: FiCheckSquare,
  history: FiClock,
  settings: FiSettings,
};

const STATUS_COLOR: Record<IcStatus, string> = {
  pending: "#94a3b8",
  crawling: "#3b82f6",
  analyzing: "#8b5cf6",
  review: "#f59e0b",
  approved: "#22c55e",
  rejected: "#ef4444",
  installing: "#3b82f6",
  installed: "#22c55e",
  failed: "#ef4444",
};

const SUBMODULE_DESC: Record<IcSubModule, string> = {
  sources: "配置该平台的自动抓取订阅源：保存查询 + 间隔，后台定时抓取、去重存档、可选自动打分。",
  analyzer: "统一分析项目价值，给出评分、标签、匹配模块。默认用 DeepSeek。",
  advisor: "升级顾问：分析价值 → 适合哪个模块 → 是否值得接入 → 生成评分与建议。",
  review: "AI 的所有推荐（加入项目 / 升级模块 / 新增功能）进入审核，必须人工确认后才执行。",
  history: "该平台的发现、分析、审核、安装历史记录。",
  settings: "打分模型、复核策略、抓取条数等全局配置。",
};

/** 已接入真实 API 的平台（全部 10 个平台均已接通） */
const CONNECTED_PLATFORMS = new Set<IcPlatformId>([
  "github",
  "huggingface",
  "modelscope",
  "npm",
  "pypi",
  "arxiv",
  "ai-news",
  "comfyui",
  "mcp",
  "ai-video",
]);

/** 各平台的查询字段 + 默认词 */
const QUERY_FIELD: Partial<Record<IcPlatformId, { key: string; placeholder: string; hint: string }>> = {
  github: { key: "q", placeholder: "text-to-video OR video-generation stars:>200", hint: "GitHub 搜索语法（可用 stars:>N、topic:）" },
  huggingface: { key: "search", placeholder: "video", hint: "HuggingFace 模型关键词" },
  modelscope: { key: "name", placeholder: "视频 / video", hint: "ModelScope 模型名称关键词" },
  npm: { key: "text", placeholder: "ai video generation", hint: "npm 包关键词" },
  pypi: { key: "q", placeholder: "留空看最新更新，或输关键词过滤", hint: "PyPI 最近更新包（关键词本地过滤）" },
  arxiv: { key: "q", placeholder: "video generation OR diffusion", hint: "arXiv 全文检索，按提交时间倒序" },
  "ai-news": { key: "query", placeholder: "AI video generation", hint: "Hacker News 资讯/讨论" },
  comfyui: { key: "search", placeholder: "留空看全部，或输关键词", hint: "ComfyUI 自定义节点（Comfy Registry）" },
  mcp: { key: "search", placeholder: "留空看全部，或输关键词", hint: "MCP Server（官方 Registry）" },
  "ai-video": { key: "search", placeholder: "留空看最新 text-to-video 模型", hint: "视频生成模型（HuggingFace pipeline）" },
};

type DiscoveredItem = {
  id: string;
  title: string;
  url?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
};

function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function MetaBadge({ label }: { label: string }) {
  return (
    <span className="rounded bg-[var(--bg-inset)] px-1.5 py-0.5 text-[10px] text-[var(--text-caption)]">{label}</span>
  );
}

type ScoredItem = {
  item: DiscoveredItem;
  score: number;
  module: string;
  worth: boolean;
  tags: string[];
  reason: string;
  scoredBy: string;
  escalated: boolean;
};
type ScoreRun = {
  items: ScoredItem[];
  costUsd: number;
  usage: { model: string; inTok: number; outTok: number; calls: number; costUsd: number }[];
  cheapModel: string;
  strongModel?: string;
  note?: string;
};

const MODEL_LABEL: Record<string, string> = {
  deepseek: "DeepSeek",
  "gemini-flash": "Gemini Flash",
  "claude-sonnet": "Claude",
  "gpt-4.1": "GPT-4.1",
  local: "本地",
};

function scoreColor(score: number): string {
  if (score >= 75) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#94a3b8";
  return "#64748b";
}

type ReviewRecord = {
  id: string;
  platformId: string;
  item: { title: string; url?: string };
  score: number;
  module: string;
  worth: boolean;
  reason: string;
  tags: string[];
  scoredBy: string;
  status: "review" | "approved" | "rejected" | "installing" | "installed" | "failed";
  install?: { kind: string; gitUrl?: string; path?: string; status: string; log?: string };
};

const REVIEW_STATUS: Record<ReviewRecord["status"], { label: string; color: string }> = {
  review: { label: "待审核", color: "#f59e0b" },
  approved: { label: "已通过", color: "#3b82f6" },
  rejected: { label: "已拒绝", color: "#ef4444" },
  installing: { label: "安装中", color: "#8b5cf6" },
  installed: { label: "已安装", color: "#22c55e" },
  failed: { label: "失败", color: "#ef4444" },
};

function ReviewPanel() {
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/intelligence-center/review`);
      const data = await res.json();
      setRecords(data.records ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    async (id: string, op: "approve" | "reject" | "install") => {
      setBusyId(id);
      try {
        await fetch(`/api/intelligence-center/review/${encodeURIComponent(id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op }),
        });
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await fetch(`/api/intelligence-center/review/${encodeURIComponent(id)}`, { method: "DELETE" });
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const pending = records.filter((r) => r.status === "review").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-caption)]">
          审核队列（全部平台）· 共 {records.length} 项 · 待审核 {pending}
        </span>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="ml-auto rounded-md border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)] disabled:opacity-60"
        >
          {loading ? "刷新中…" : "刷新"}
        </button>
      </div>

      {records.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-6 py-10 text-center">
          <p className="text-sm text-[var(--text-caption)]">
            队列为空。到任意平台的「订阅源」自动抓取 → 在「已抓取」里点「加入审核」。
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {records.map((r) => {
          const st = REVIEW_STATUS[r.status];
          const busy = busyId === r.id;
          const noGit = r.install?.kind === "none";
          return (
            <li key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-white"
                  style={{ background: scoreColor(r.score) }}
                >
                  {r.score}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {r.item.url ? (
                      <a
                        href={r.item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-sm font-medium text-[var(--accent)] hover:underline"
                      >
                        {r.item.title}
                      </a>
                    ) : (
                      <span className="truncate text-sm font-medium text-[var(--text-primary)]">{r.item.title}</span>
                    )}
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: `${st.color}1f`, color: st.color }}
                    >
                      {st.label}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-caption)]">
                    <MetaBadge label={r.platformId} />
                    {r.module && r.module !== "无" && <MetaBadge label={r.module} />}
                    <MetaBadge label={r.worth ? "建议接入" : "可选"} />
                    <MetaBadge label={MODEL_LABEL[r.scoredBy] ?? r.scoredBy} />
                  </div>
                  {r.reason && <p className="mt-1 text-xs text-[var(--text-secondary)]">💡 {r.reason}</p>}
                  {r.install?.path && (
                    <p className="mt-1 break-all text-[11px] text-[#22c55e]">已克隆到：{r.install.path}</p>
                  )}
                  {r.status === "failed" && r.install?.log && (
                    <p className="mt-1 break-all text-[11px] text-[#ef4444]">
                      {r.install.log.slice(-160)}
                    </p>
                  )}
                  {noGit && r.status !== "installed" && (
                    <p className="mt-1 text-[11px] text-[var(--text-caption)]">该项无 git 源，不支持自动安装（可点标题收藏链接）</p>
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {r.status === "review" && (
                  <>
                    <button
                      type="button"
                      onClick={() => act(r.id, "approve")}
                      disabled={busy}
                      className="rounded-md bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                    >
                      通过
                    </button>
                    <button
                      type="button"
                      onClick={() => act(r.id, "reject")}
                      disabled={busy}
                      className="rounded-md border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)] disabled:opacity-60"
                    >
                      拒绝
                    </button>
                  </>
                )}
                {(r.status === "approved" || r.status === "failed") && !noGit && (
                  <button
                    type="button"
                    onClick={() => act(r.id, "install")}
                    disabled={busy}
                    className="rounded-md bg-[#8b5cf6] px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {busy ? "安装中…" : r.status === "failed" ? "重试安装" : "安装（git clone）"}
                  </button>
                )}
                {r.status === "installing" && (
                  <span className="text-xs text-[#8b5cf6]">安装中…</span>
                )}
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  disabled={busy}
                  className="ml-auto rounded-md px-3 py-1 text-xs text-[var(--text-caption)] hover:text-[#ef4444] disabled:opacity-60"
                >
                  移除
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type IcEventUI = {
  id: string;
  at: string;
  platformId?: string;
  kind: keyof typeof EVENT_KIND;
  level: "info" | "warn" | "error";
  message: string;
};

const EVENT_KIND = {
  discover: { label: "发现", color: "#3b82f6" },
  score: { label: "打分", color: "#8b5cf6" },
  enqueue: { label: "加入审核", color: "#f59e0b" },
  approve: { label: "通过", color: "#22c55e" },
  reject: { label: "拒绝", color: "#ef4444" },
  install: { label: "安装", color: "#8b5cf6" },
} as const;

const LEVEL_COLOR: Record<string, string> = { info: "#94a3b8", warn: "#f59e0b", error: "#ef4444" };

function useEvents(platformId: IcPlatformId, allPlatforms: boolean) {
  const [events, setEvents] = useState<IcEventUI[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: "200" });
      if (!allPlatforms) q.set("platform", platformId);
      const res = await fetch(`/api/intelligence-center/events?${q.toString()}`);
      const data = await res.json();
      setEvents(data.events ?? []);
    } finally {
      setLoading(false);
    }
  }, [platformId, allPlatforms]);
  useEffect(() => {
    load();
  }, [load]);
  return { events, loading, reload: load };
}

function ScopeBar({
  allPlatforms,
  setAllPlatforms,
  loading,
  reload,
  extra,
}: {
  allPlatforms: boolean;
  setAllPlatforms: (v: boolean) => void;
  loading: boolean;
  reload: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded-md border border-[var(--border)] text-xs">
        <button
          type="button"
          onClick={() => setAllPlatforms(false)}
          className={`px-3 py-1 ${!allPlatforms ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)]"}`}
        >
          本平台
        </button>
        <button
          type="button"
          onClick={() => setAllPlatforms(true)}
          className={`px-3 py-1 ${allPlatforms ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)]"}`}
        >
          全部平台
        </button>
      </div>
      {extra}
      <button
        type="button"
        onClick={reload}
        disabled={loading}
        className="ml-auto rounded-md border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)] disabled:opacity-60"
      >
        {loading ? "刷新中…" : "刷新"}
      </button>
    </div>
  );
}

function HistoryPanel({ platformId }: { platformId: IcPlatformId }) {
  const [allPlatforms, setAllPlatforms] = useState(false);
  const { events, loading, reload } = useEvents(platformId, allPlatforms);
  const counts = (Object.keys(EVENT_KIND) as (keyof typeof EVENT_KIND)[]).map((k) => ({
    k,
    n: events.filter((e) => e.kind === k).length,
  }));

  return (
    <div className="space-y-3">
      <ScopeBar allPlatforms={allPlatforms} setAllPlatforms={setAllPlatforms} loading={loading} reload={reload} />
      <div className="flex flex-wrap gap-2">
        {counts.map(({ k, n }) => (
          <span
            key={k}
            className="rounded-lg px-2.5 py-1 text-xs font-medium"
            style={{ background: `${EVENT_KIND[k].color}14`, color: EVENT_KIND[k].color }}
          >
            {EVENT_KIND[k].label} {n}
          </span>
        ))}
      </div>
      {events.length === 0 && !loading && (
        <p className="text-sm text-[var(--text-caption)]">暂无历史。发现 → 打分 → 审核 → 安装的每一步都会留档。</p>
      )}
      <ol className="relative space-y-2 border-l border-[var(--border)] pl-4">
        {events.map((e) => (
          <li key={e.id} className="relative">
            <span
              className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full"
              style={{ background: EVENT_KIND[e.kind]?.color ?? "#64748b" }}
            />
            <div className="flex items-center gap-2">
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ background: EVENT_KIND[e.kind]?.color ?? "#64748b" }}
              >
                {EVENT_KIND[e.kind]?.label ?? e.kind}
              </span>
              {allPlatforms && e.platformId && (
                <span className="text-[11px] text-[var(--text-caption)]">{e.platformId}</span>
              )}
              <span className="text-[11px] text-[var(--text-caption)]">{e.at.replace("T", " ").slice(0, 19)}</span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{e.message}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

type SettingsShape = {
  defaultAnalyzerModel: string;
  useStrongReview: boolean;
  strongModel: string;
  escalateMin: number;
  strongBudget: number;
  minScoreToRecommend: number;
  autoEnqueue: boolean;
  discoverPageSize: number;
  requireHumanReview: boolean;
};

function SettingsPanel() {
  const [s, setS] = useState<SettingsShape | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/intelligence-center/settings`)
      .then((r) => r.json())
      .then((d) => setS(d.settings));
  }, []);

  const patch = (p: Partial<SettingsShape>) => {
    setS((cur) => (cur ? { ...cur, ...p } : cur));
    setSaved(false);
  };

  const save = async () => {
    if (!s) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/intelligence-center/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      const d = await res.json();
      setS(d.settings);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (!s) return <p className="text-sm text-[var(--text-caption)]">加载中…</p>;

  const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] py-3">
      <div>
        <p className="text-sm text-[var(--text-primary)]">{label}</p>
        {hint && <p className="text-xs text-[var(--text-caption)]">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
  const inputCls =
    "w-20 rounded-md border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1 text-sm text-[var(--text-primary)]";
  const selCls = "rounded-md border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1 text-sm text-[var(--text-primary)]";

  return (
    <div className="space-y-1">
      <p className="text-xs text-[var(--text-caption)]">情报中心设置（全局）· 打分与发现会实际读取这些值</p>
      <Row label="便宜档打分模型" hint="批量打分用，最省成本">
        <select value={s.defaultAnalyzerModel} onChange={(e) => patch({ defaultAnalyzerModel: e.target.value })} className={selCls}>
          <option value="deepseek">DeepSeek（最便宜）</option>
          <option value="gemini-flash">Gemini Flash</option>
        </select>
      </Row>
      <Row label="强模型复核高分项" hint="只重判高分/临界项，控成本">
        <input type="checkbox" checked={s.useStrongReview} onChange={(e) => patch({ useStrongReview: e.target.checked })} />
      </Row>
      <Row label="强档模型" hint="复核用">
        <select value={s.strongModel} onChange={(e) => patch({ strongModel: e.target.value })} className={selCls}>
          <option value="claude-sonnet">Claude Sonnet</option>
          <option value="gpt-4.1">GPT-4.1</option>
        </select>
      </Row>
      <Row label="复核触发分" hint="便宜档达到多少分才送强模型">
        <input type="number" min={0} max={100} value={s.escalateMin} onChange={(e) => patch({ escalateMin: Number(e.target.value) })} className={inputCls} />
      </Row>
      <Row label="复核预算（项/次）" hint="每次最多复核多少项，封顶成本">
        <input type="number" min={0} max={50} value={s.strongBudget} onChange={(e) => patch({ strongBudget: Number(e.target.value) })} className={inputCls} />
      </Row>
      <Row label="自动加入审核" hint="自动打分后，达标项免手动点、直接进审核队列">
        <input type="checkbox" checked={s.autoEnqueue} onChange={(e) => patch({ autoEnqueue: e.target.checked })} />
      </Row>
      <Row label="自动加入审核的分数线" hint="打分 ≥ 此值才自动进审核队列">
        <input type="number" min={0} max={100} value={s.minScoreToRecommend} onChange={(e) => patch({ minScoreToRecommend: Number(e.target.value) })} className={inputCls} />
      </Row>
      <Row label="每次发现条数" hint="抓取默认条数（1-50）">
        <input type="number" min={1} max={50} value={s.discoverPageSize} onChange={(e) => patch({ discoverPageSize: Number(e.target.value) })} className={inputCls} />
      </Row>
      <Row label="强制人工审核" hint="安装前必须人工通过">
        <input type="checkbox" checked={s.requireHumanReview} onChange={(e) => patch({ requireHumanReview: e.target.checked })} />
      </Row>
      <div className="flex items-center gap-3 pt-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "保存中…" : "保存"}
        </button>
        {saved && <span className="text-xs text-[#22c55e]">已保存</span>}
      </div>
    </div>
  );
}

type SavedSource = {
  id: string;
  platformId: string;
  name: string;
  query: Record<string, unknown>;
  enabled: boolean;
  intervalMinutes: number;
  autoScore: boolean;
  lastRunAt?: string | null;
  lastCount?: number;
  lastError?: string | null;
  nextPage?: number;
};
type StoredDiscovery = {
  item: { id: string; title: string; url?: string; platformId: string };
  firstSeenAt: string;
  score?: number;
  module?: string;
  worth?: boolean;
  reason?: string;
  scoredBy?: string;
  tags?: string[];
  advice?: string;
};

/** 把一条发现项加入审核队列（分析/顾问/订阅源三处共用） */
async function postEnqueue(d: StoredDiscovery): Promise<boolean> {
  try {
    const res = await fetch(`/api/intelligence-center/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            item: d.item,
            score: d.score ?? 0,
            module: d.module ?? "无",
            worth: d.worth ?? false,
            reason: d.reason ?? "",
            tags: d.tags ?? [],
            scoredBy: d.scoredBy ?? "local",
          },
        ],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const INTERVAL_OPTIONS = [
  { v: 30, label: "30 分钟" },
  { v: 60, label: "1 小时" },
  { v: 180, label: "3 小时" },
  { v: 360, label: "6 小时" },
  { v: 720, label: "12 小时" },
  { v: 1440, label: "24 小时" },
];

function fmtTime(iso?: string | null): string {
  if (!iso) return "从未";
  return iso.replace("T", " ").slice(5, 16);
}

function SourceManagerPanel({ platformId }: { platformId: IcPlatformId }) {
  const field = QUERY_FIELD[platformId]!;
  const [sources, setSources] = useState<SavedSource[]>([]);
  const [discoveries, setDiscoveries] = useState<StoredDiscovery[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [name, setName] = useState("");
  const [queryVal, setQueryVal] = useState("");
  const [interval, setInterval] = useState(60);
  const [autoScore, setAutoScore] = useState(false);
  const [recentDays, setRecentDays] = useState("");
  const [enqueuedIds, setEnqueuedIds] = useState<Set<string>>(new Set());

  const enqueueDiscovery = useCallback(async (d: StoredDiscovery) => {
    try {
      const res = await fetch(`/api/intelligence-center/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              item: d.item,
              score: d.score ?? 0,
              module: d.module ?? "无",
              worth: d.worth ?? false,
              reason: d.reason ?? "",
              tags: [],
              scoredBy: d.scoredBy ?? "local",
            },
          ],
        }),
      });
      if (res.ok) setEnqueuedIds((prev) => new Set(prev).add(d.item.id));
    } catch {
      /* 忽略 */
    }
  }, []);

  const load = useCallback(async () => {
    const [s, d] = await Promise.all([
      fetch(`/api/intelligence-center/sources?platform=${platformId}`).then((r) => r.json()),
      fetch(`/api/intelligence-center/discoveries?platform=${platformId}&limit=50`).then((r) => r.json()),
    ]);
    setSources(s.sources ?? []);
    setDiscoveries(d.discoveries ?? []);
  }, [platformId]);

  useEffect(() => {
    load();
    setName("");
    setQueryVal("");
  }, [load]);

  const add = useCallback(async () => {
    setAdding(true);
    try {
      const query: Record<string, string> = {};
      if (queryVal.trim()) query[field.key] = queryVal.trim();
      if (platformId === "github" && Number(recentDays) > 0) query.days = String(Number(recentDays));
      await fetch(`/api/intelligence-center/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformId,
          name: name.trim() || `${platformId}：${queryVal.trim() || "默认"}`,
          query,
          intervalMinutes: interval,
          autoScore,
          enabled: true,
        }),
      });
      setName("");
      setQueryVal("");
      setRecentDays("");
      await load();
    } finally {
      setAdding(false);
    }
  }, [platformId, name, queryVal, field.key, interval, autoScore, recentDays, load]);

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setBusyId(id);
      try {
        await fetch(`/api/intelligence-center/sources/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const del = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await fetch(`/api/intelligence-center/sources/${id}`, { method: "DELETE" });
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const seedAll = useCallback(async () => {
    setSeeding(true);
    setSeedMsg("");
    try {
      const res = await fetch(`/api/intelligence-center/sources/seed`, { method: "POST" });
      const d = await res.json();
      setSeedMsg(`已铺满全部平台：新建 ${d.created} 个源，跳过 ${d.skipped} 个已存在`);
      await load();
    } finally {
      setSeeding(false);
    }
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-xs text-[var(--text-secondary)]">
        保存订阅源后，后台每隔设定时间自动抓取；新项目去重存档，可在下方「已抓取」查看。留空查询=用平台默认词。
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/8 px-3 py-2">
        <span className="text-xs text-[var(--text-secondary)]">
          一键铺满：给全部 10 个平台播下推荐源（GitHub 存量+盯新，其余按各自最优策略），立即开跑。
        </span>
        <button
          type="button"
          onClick={seedAll}
          disabled={seeding}
          className="ml-auto rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {seeding ? "铺设中…" : "一键铺满全部平台"}
        </button>
        {seedMsg && <span className="w-full text-xs text-[#22c55e]">{seedMsg}</span>}
      </div>

      {/* 新建源 */}
      <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">新建自动抓取源</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="源名称（可留空自动生成）"
            className="min-w-[160px] flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <input
            value={queryVal}
            onChange={(e) => setQueryVal(e.target.value)}
            placeholder={`查询：${field.placeholder}`}
            className="min-w-[200px] flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            间隔
            <select
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              className="rounded-md border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1 text-xs text-[var(--text-primary)]"
            >
              {INTERVAL_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {platformId === "github" && (
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              只抓最近
              <input
                type="number"
                min={0}
                value={recentDays}
                onChange={(e) => setRecentDays(e.target.value)}
                placeholder="不限"
                className="w-16 rounded-md border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1 text-xs text-[var(--text-primary)]"
              />
              天新建
            </label>
          )}
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <input type="checkbox" checked={autoScore} onChange={(e) => setAutoScore(e.target.checked)} />
            抓完自动打分（便宜档，产生少量费用）
          </label>
          <button
            type="button"
            onClick={add}
            disabled={adding}
            className="ml-auto rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {adding ? "添加中…" : "添加"}
          </button>
        </div>
      </div>

      {/* 源列表 */}
      <div className="space-y-2">
        <p className="text-xs text-[var(--text-caption)]">订阅源（{sources.length}）</p>
        {sources.length === 0 && <p className="text-sm text-[var(--text-caption)]">还没有源。上面添加一个即可开始自动抓取。</p>}
        {sources.map((s) => {
          const busy = busyId === s.id;
          const q = Object.values(s.query ?? {}).join(" ") || "（默认词）";
          return (
            <div key={s.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: s.enabled ? "#22c55e" : "#94a3b8" }}
                  title={s.enabled ? "启用" : "已暂停"}
                />
                <span className="truncate text-sm font-medium text-[var(--text-primary)]">{s.name}</span>
                {s.autoScore && <MetaBadge label="自动打分" />}
                <span className="ml-auto shrink-0 text-[11px] text-[var(--text-caption)]">
                  每 {INTERVAL_OPTIONS.find((o) => o.v === s.intervalMinutes)?.label ?? `${s.intervalMinutes} 分`}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-caption)]">
                <MetaBadge label={`查询：${q}`} />
                <span>上次：{fmtTime(s.lastRunAt)}</span>
                <span>新增 {s.lastCount ?? 0}</span>
                <span>下次抓第 {s.nextPage ?? 1} 页</span>
                {s.lastError && <span className="text-[#ef4444]">错误：{s.lastError}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => patch(s.id, { op: "run" })}
                  disabled={busy}
                  className="rounded-md bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                >
                  {busy ? "运行中…" : "立即运行"}
                </button>
                <button
                  type="button"
                  onClick={() => patch(s.id, { enabled: !s.enabled })}
                  disabled={busy}
                  className="rounded-md border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)] disabled:opacity-60"
                >
                  {s.enabled ? "暂停" : "启用"}
                </button>
                <button
                  type="button"
                  onClick={() => patch(s.id, { autoScore: !s.autoScore })}
                  disabled={busy}
                  className="rounded-md border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)] disabled:opacity-60"
                >
                  {s.autoScore ? "关自动打分" : "开自动打分"}
                </button>
                <button
                  type="button"
                  onClick={() => del(s.id)}
                  disabled={busy}
                  className="ml-auto rounded-md px-3 py-1 text-xs text-[var(--text-caption)] hover:text-[#ef4444] disabled:opacity-60"
                >
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 已抓取 */}
      <div className="space-y-2">
        <p className="text-xs text-[var(--text-caption)]">已抓取（{discoveries.length}）· 自动去重留档</p>
        {discoveries.length === 0 && <p className="text-sm text-[var(--text-caption)]">暂无。源运行后新项目会出现在这里。</p>}
        <ul className="space-y-1.5">
          {discoveries.map((d) => (
            <li key={d.item.id} className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2.5">
              {d.score != null && (
                <span
                  className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                  style={{ background: scoreColor(d.score) }}
                >
                  {d.score}
                </span>
              )}
              <div className="min-w-0 flex-1">
                {d.item.url ? (
                  <a href={d.item.url} target="_blank" rel="noreferrer" className="truncate text-sm text-[var(--accent)] hover:underline">
                    {d.item.title}
                  </a>
                ) : (
                  <span className="truncate text-sm text-[var(--text-primary)]">{d.item.title}</span>
                )}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-caption)]">
                  <span>{fmtTime(d.firstSeenAt)}</span>
                  {d.module && d.module !== "无" && <MetaBadge label={d.module} />}
                  {d.reason && <span className="text-[var(--text-secondary)]">· {d.reason}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => enqueueDiscovery(d)}
                disabled={enqueuedIds.has(d.item.id)}
                className="shrink-0 self-center rounded border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
              >
                {enqueuedIds.has(d.item.id) ? "已加入审核" : "加入审核"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ScoredRow({
  d,
  enqueued,
  onEnqueue,
  onGoReview,
  showPlatform,
}: {
  d: StoredDiscovery;
  enqueued: boolean;
  onEnqueue: () => void;
  onGoReview: () => void;
  showPlatform?: boolean;
}) {
  return (
    <li className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2.5">
      <span
        className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold text-white"
        style={{ background: scoreColor(d.score ?? 0) }}
      >
        {d.score ?? "-"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {d.item.url ? (
            <a href={d.item.url} target="_blank" rel="noreferrer" className="truncate text-sm text-[var(--accent)] hover:underline">
              {d.item.title}
            </a>
          ) : (
            <span className="truncate text-sm text-[var(--text-primary)]">{d.item.title}</span>
          )}
          {d.worth && <span className="shrink-0 rounded px-1 text-[10px] text-[#22c55e]" style={{ background: "#22c55e1f" }}>建议接入</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-caption)]">
          {showPlatform && <MetaBadge label={IC_PLATFORMS.find((p) => p.id === d.item.platformId)?.nameZh ?? d.item.platformId} />}
          {d.module && d.module !== "无" && <MetaBadge label={d.module} />}
          {(d.tags ?? []).slice(0, 4).map((t) => (
            <span key={t} className="rounded bg-[var(--accent)]/10 px-1 text-[var(--accent)]">{t}</span>
          ))}
        </div>
        {d.reason && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">💡 {d.reason}</p>}
        {d.advice && <p className="mt-0.5 text-xs text-[var(--accent)]">🔧 {d.advice}</p>}
      </div>
      {enqueued ? (
        <button type="button" onClick={onGoReview} className="shrink-0 self-center rounded px-2 py-0.5 text-[10px] text-[var(--accent)]">
          去审核队列 →
        </button>
      ) : (
        <button
          type="button"
          onClick={onEnqueue}
          className="shrink-0 self-center rounded border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          加入审核
        </button>
      )}
    </li>
  );
}

function AnalyzerPanel({ platformId, onGoReview }: { platformId: IcPlatformId; onGoReview: () => void }) {
  const [allPlatforms, setAllPlatforms] = useState(true);
  const [items, setItems] = useState<StoredDiscovery[]>([]);
  const [loading, setLoading] = useState(false);
  const [enqueued, setEnqueued] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: "500" });
      if (!allPlatforms) q.set("platform", platformId);
      const d = await fetch(`/api/intelligence-center/discoveries?${q.toString()}`).then((r) => r.json());
      const scored = ((d.discoveries ?? []) as StoredDiscovery[])
        .filter((x) => typeof x.score === "number")
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      setItems(scored);
    } finally {
      setLoading(false);
    }
  }, [platformId, allPlatforms]);

  useEffect(() => {
    load();
  }, [load]);

  const enqueue = useCallback(async (d: StoredDiscovery) => {
    if (await postEnqueue(d)) setEnqueued((p) => new Set(p).add(d.item.id));
  }, []);

  return (
    <div className="space-y-3">
      <ScopeBar allPlatforms={allPlatforms} setAllPlatforms={setAllPlatforms} loading={loading} reload={load} />
      <p className="text-xs text-[var(--text-caption)]">已打分项目（{items.length}）· 按分数排序。打分来自订阅源的「自动打分」。</p>
      {items.length === 0 && !loading && (
        <p className="text-sm text-[var(--text-caption)]">还没有打分数据。到「订阅源」给源开启「自动打分」，后台抓完会自动打分。</p>
      )}
      <ul className="space-y-1.5">
        {items.map((d) => (
          <ScoredRow key={d.item.id} d={d} showPlatform enqueued={enqueued.has(d.item.id)} onEnqueue={() => enqueue(d)} onGoReview={onGoReview} />
        ))}
      </ul>
    </div>
  );
}

function AdvisorPanel({ platformId, onGoReview }: { platformId: IcPlatformId; onGoReview: () => void }) {
  const [allPlatforms, setAllPlatforms] = useState(true);
  const [items, setItems] = useState<StoredDiscovery[]>([]);
  const [threshold, setThreshold] = useState(60);
  const [loading, setLoading] = useState(false);
  const [enqueued, setEnqueued] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        fetch(`/api/intelligence-center/settings`).then((r) => r.json()),
        fetch(`/api/intelligence-center/discoveries?${new URLSearchParams(allPlatforms ? { limit: "500" } : { limit: "500", platform: platformId })}`).then((r) => r.json()),
      ]);
      const th = s?.settings?.minScoreToRecommend ?? 60;
      setThreshold(th);
      const rec = ((d.discoveries ?? []) as StoredDiscovery[])
        .filter((x) => x.worth || (typeof x.score === "number" && x.score >= th))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      setItems(rec);
    } finally {
      setLoading(false);
    }
  }, [platformId, allPlatforms]);

  useEffect(() => {
    load();
  }, [load]);

  const enqueue = useCallback(async (d: StoredDiscovery) => {
    if (await postEnqueue(d)) setEnqueued((p) => new Set(p).add(d.item.id));
  }, []);

  const groups = new Map<string, StoredDiscovery[]>();
  for (const d of items) {
    const k = d.module && d.module !== "无" ? d.module : "其他";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(d);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => (b[1][0]?.score ?? 0) - (a[1][0]?.score ?? 0));

  return (
    <div className="space-y-3">
      <ScopeBar allPlatforms={allPlatforms} setAllPlatforms={setAllPlatforms} loading={loading} reload={load} />
      <p className="text-xs text-[var(--text-caption)]">接入建议（{items.length}）· 值得接入或 ≥{threshold} 分，按建议接入的工作台模块分组。</p>
      {items.length === 0 && !loading && (
        <p className="text-sm text-[var(--text-caption)]">暂无建议。开启订阅源「自动打分」后，高分项会出现在这里。</p>
      )}
      <div className="space-y-4">
        {sortedGroups.map(([mod, list]) => (
          <div key={mod} className="space-y-1.5">
            <p className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
              <FiTrendingUp className="h-3.5 w-3.5 text-[var(--accent)]" />
              建议升级：{mod} <span className="text-[var(--text-caption)]">（{list.length}）</span>
            </p>
            <ul className="space-y-1.5">
              {list.map((d) => (
                <ScoredRow key={d.item.id} d={d} showPlatform enqueued={enqueued.has(d.item.id)} onEnqueue={() => enqueue(d)} onGoReview={onGoReview} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IntelligenceCenterShell() {
  const [platformId, setPlatformId] = useState<IcPlatformId>(IC_PLATFORMS[0].id);
  const [sub, setSub] = useState<IcSubModule>("sources");
  const platform = IC_PLATFORMS.find((p) => p.id === platformId)!;
  const SubIcon = SUBMODULE_ICON[sub];
  const connected = CONNECTED_PLATFORMS.has(platformId);

  return (
    <div className="flex h-full min-h-0">
      {/* 左：12 平台 */}
      <aside className="w-56 shrink-0 overflow-y-auto border-r border-[var(--border)] p-3">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-caption)]">
          平台中心（10）
        </p>
        <nav className="flex flex-col gap-1">
          {IC_PLATFORMS.map((p) => {
            const Icon = PLATFORM_ICON[p.id];
            const active = p.id === platformId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatformId(p.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-[var(--bg-inset)] font-semibold text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{p.nameZh}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 右：平台头 + 8 子模块 tab + 内容 */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{platform.nameZh}</h2>
            <span className="rounded-full bg-[var(--bg-inset)] px-2 py-0.5 text-xs text-[var(--text-caption)]">{platform.category}</span>
            {connected ? (
              <span className="rounded-full bg-[#22c55e]/12 px-2 py-0.5 text-xs text-[#22c55e]">已接入 API</span>
            ) : (
              <span className="rounded-full bg-[#f59e0b]/12 px-2 py-0.5 text-xs text-[#f59e0b]">架构就绪 · 待接入 API</span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{platform.description}</p>
        </header>

        {/* 子模块 tab */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--border)] px-4 py-2">
          {IC_SUBMODULES.map((m) => {
            const Icon = SUBMODULE_ICON[m.id];
            const active = m.id === sub;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSub(m.id)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  active ? "bg-[var(--accent)] text-white" : "text-[var(--text-caption)] hover:bg-[var(--bg-inset)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* 内容（架构占位）*/}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl space-y-5">
            <div className="flex items-center gap-2">
              <SubIcon className="h-5 w-5 text-[var(--accent)]" />
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {IC_SUBMODULES.find((m) => m.id === sub)?.label}
              </h3>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{SUBMODULE_DESC[sub]}</p>

            {sub === "review" ? (
              <ReviewPanel />
            ) : sub === "settings" ? (
              <SettingsPanel />
            ) : sub === "history" ? (
              <HistoryPanel platformId={platformId} />
            ) : sub === "analyzer" ? (
              <AnalyzerPanel platformId={platformId} onGoReview={() => setSub("review")} />
            ) : sub === "advisor" ? (
              <AdvisorPanel platformId={platformId} onGoReview={() => setSub("review")} />
            ) : connected && sub === "sources" ? (
              <SourceManagerPanel platformId={platformId} />
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-6 py-10 text-center">
                <p className="text-sm text-[var(--text-caption)]">
                  {connected
                    ? "该平台已接入 API。到「订阅源」子模块配置自动抓取，新项目会去重存档并可加入审核；审核/安装到「审核队列」子模块操作。"
                    : "架构已就绪。本阶段不接 API、不抓数据。接入 API 后此处显示实际内容。"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 底部：统一状态系统图例 */}
        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-inset)] px-4 py-2">
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="font-medium text-[var(--text-secondary)]">统一状态：</span>
            {(Object.keys(IC_STATUS_LABEL) as IcStatus[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1 text-[var(--text-caption)]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                {IC_STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
