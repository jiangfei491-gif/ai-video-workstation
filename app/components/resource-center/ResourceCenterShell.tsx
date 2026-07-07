"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiBook,
  FiBox,
  FiDatabase,
  FiCpu,
  FiClock,
  FiDownload,
  FiFilm,
  FiGlobe,
  FiImage,
  FiLayers,
  FiMic,
  FiMusic,
  FiStar,
  FiType,
  FiUser,
  FiZap,
} from "react-icons/fi";
import type { LibraryDefinition, LibraryId, LibraryStats } from "@/app/lib/resource-center/types";
import SourceManagerPanel from "./SourceManagerPanel";
import CrawlerTasksPanel from "./CrawlerTasksPanel";
import DownloadTasksPanel from "./DownloadTasksPanel";
import AnalyzerPanel from "./AnalyzerPanel";
import LibraryIngestPanel from "./LibraryIngestPanel";
import SchedulerDashboardPanel from "./SchedulerDashboardPanel";
import LibraryContent from "./LibraryContent";

type Tab = "libraries" | "sources" | "crawler" | "downloads" | "analyzer" | "ingest" | "scheduler";

type ApiLibrary = LibraryDefinition & { stats: LibraryStats };

type ResourceCenterPayload = {
  libraries: ApiLibrary[];
  globalStats: {
    totalLibraries: number;
    totalResources: number;
    totalDbRecords: number;
  };
  workspaceRoot: string;
};

const LIBRARY_ICONS: Record<LibraryId, React.ComponentType<{ className?: string }>> = {
  image: FiImage,
  video: FiFilm,
  music: FiMusic,
  sfx: FiZap,
  voice: FiMic,
  subtitle: FiType,
  effect: FiLayers,
  prompt: FiBook,
  character: FiUser,
  lora: FiBox,
  dataset: FiDatabase,
};

const CAPABILITY_LABELS: { key: keyof LibraryDefinition["capabilities"]; label: string }[] = [
  { key: "category", label: "分类" },
  { key: "tags", label: "标签" },
  { key: "search", label: "搜索" },
  { key: "favorite", label: "收藏" },
  { key: "rating", label: "评分" },
  { key: "enableDisable", label: "启用/禁用" },
  { key: "stats", label: "统计" },
  { key: "dbIndex", label: "数据库索引" },
  { key: "resourceCount", label: "资源数量" },
  { key: "updatedAt", label: "更新时间" },
  { key: "thumbnail", label: "缩略图" },
  { key: "preview", label: "预览" },
  { key: "detail", label: "详情" },
];

export default function ResourceCenterShell() {
  const [tab, setTab] = useState<Tab>("libraries");
  const [data, setData] = useState<ResourceCenterPayload | null>(null);
  const [selectedId, setSelectedId] = useState<LibraryId>("image");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/resource-center", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ResourceCenterPayload;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = useMemo(
    () => data?.libraries.find((l) => l.id === selectedId) ?? null,
    [data, selectedId]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
        <h1 className="workbench-page-title">资源中心</h1>
        <p className="workbench-page-desc mt-1">
          AI Video OS 唯一资源入口 · Source → Crawler → Downloader → AI Analyzer → Library → AI Resource Service
        </p>
        <div className="mt-3 flex flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-1">
          {(
            [
              ["libraries", "内容库", FiLayers],
              ["sources", "资源站", FiGlobe],
              ["crawler", "抓取", FiZap],
              ["downloads", "下载", FiDownload],
              ["scheduler", "调度", FiClock],
              ["analyzer", "AI分析", FiCpu],
              ["ingest", "入库", FiDatabase],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex min-h-[18px] flex-wrap gap-3 text-xs text-[var(--text-caption)]">
          {data ? (
            <>
              <span>内容库 {data.globalStats.totalLibraries}</span>
              <span>资源 {data.globalStats.totalResources}</span>
              <span>DB 记录 {data.globalStats.totalDbRecords}</span>
              <span className="truncate">Workspace: {data.workspaceRoot}</span>
            </>
          ) : loading ? (
            <span>加载统计…</span>
          ) : null}
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          加载失败：{error}
        </div>
      )}

      {tab === "libraries" && (
      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr] overflow-hidden">
        <aside className="overflow-y-auto border-r border-[var(--border)] p-3">
          {loading && !data ? (
            <p className="px-2 py-4 text-sm text-[var(--text-caption)]">加载中…</p>
          ) : (
            <nav className="flex flex-col gap-1">
              {data?.libraries.map((lib) => {
                const Icon = LIBRARY_ICONS[lib.id];
                const active = selectedId === lib.id;
                return (
                  <button
                    key={lib.id}
                    type="button"
                    onClick={() => setSelectedId(lib.id)}
                    className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      active
                        ? "bg-[var(--bg-inset)] font-semibold text-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <span className="block">{lib.titleZh}</span>
                      <span className="mt-0.5 block text-xs font-normal text-[var(--text-caption)]">
                        {lib.stats.resourceCount} 项
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
        </aside>

        <main className="min-h-0 overflow-y-auto overflow-anchor-none p-6">
          {selected ? (
            <div className="mx-auto max-w-4xl space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">{selected.titleZh}</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{selected.description}</p>
                <p className="mt-2 font-mono text-xs text-[var(--text-caption)]">
                  storage/library/{selected.storageDir}/
                </p>
              </div>

              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["资源", selected.stats.resourceCount],
                  ["文件", selected.stats.fileCount],
                  ["DB", selected.stats.dbRecordCount],
                  ["启用", selected.stats.enabledCount],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-4 py-3"
                  >
                    <p className="text-xs text-[var(--text-caption)]">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{value}</p>
                  </div>
                ))}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">管理分类</h3>
                <div className="flex flex-wrap gap-2">
                  {selected.categories.map((cat) => (
                    <span
                      key={cat}
                      className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)]"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">统一能力</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CAPABILITY_LABELS.map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          selected.capabilities[key] ? "bg-[var(--success)]" : "bg-[var(--border)]"
                        }`}
                      />
                      <span className="text-[var(--text-secondary)]">{label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">数据库映射</h3>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] p-4 font-mono text-xs text-[var(--text-secondary)]">
                  <p>primary: {selected.dbMapping.primaryTable}</p>
                  {selected.dbMapping.secondaryTables?.length ? (
                    <p className="mt-1">secondary: {selected.dbMapping.secondaryTables.join(", ")}</p>
                  ) : null}
                  {selected.dbMapping.assetKinds?.length ? (
                    <p className="mt-1">assets.kind: {selected.dbMapping.assetKinds.join(", ")}</p>
                  ) : null}
                  {selected.dbMapping.templateKind ? (
                    <p className="mt-1">templates.kind: {selected.dbMapping.templateKind}</p>
                  ) : null}
                </div>
              </section>

              <LibraryContent libraryId={selected.id} />
            </div>
          ) : (
            <p className="text-sm text-[var(--text-caption)]">请选择内容库</p>
          )}
        </main>
      </div>
      )}

      {tab === "sources" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <SourceManagerPanel />
        </div>
      )}

      {tab === "crawler" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <CrawlerTasksPanel />
        </div>
      )}

      {tab === "downloads" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <DownloadTasksPanel />
        </div>
      )}

      {tab === "scheduler" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <SchedulerDashboardPanel />
        </div>
      )}

      {tab === "analyzer" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <AnalyzerPanel />
        </div>
      )}

      {tab === "ingest" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <LibraryIngestPanel />
        </div>
      )}
    </div>
  );
}
