"use client";

import { useCallback, useEffect, useState } from "react";
import { FiBook, FiClipboard, FiEdit3, FiMusic, FiSearch, FiX } from "react-icons/fi";
import {
  COMMERCIAL_TAGS,
  MIN_PUBLIC_OVERALL_SCORE,
  MOOD_TAGS,
  MUSIC_SUBMODULE_LABEL,
  PUBLIC_CATEGORIES,
  SCENE_TAGS,
  STYLE_TAGS,
  type MusicSubModule,
  type OriginalLyric,
  type OriginalPrompt,
  type OriginalVersion,
  type PublicLyric,
  type SeedProgress,
} from "@/app/lib/music-module/types";

const SUB_ICON: Record<MusicSubModule, React.ComponentType<{ className?: string }>> = {
  "public-lyrics": FiBook,
  "original-lyrics": FiEdit3,
};

export default function MusicModuleShell() {
  const [tab, setTab] = useState<MusicSubModule>("public-lyrics");

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-[var(--border)] p-3">
        <p className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold text-[var(--text-caption)]">
          <FiMusic className="h-3.5 w-3.5" /> 音乐
        </p>
        {(Object.keys(MUSIC_SUBMODULE_LABEL) as MusicSubModule[]).map((id) => {
          const Icon = SUB_ICON[id];
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                active ? "nav-item-active font-semibold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {MUSIC_SUBMODULE_LABEL[id]}
            </button>
          );
        })}
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === "public-lyrics" ? <PublicLyricsPanel /> : <OriginalLyricsPanel />}
      </main>
    </div>
  );
}

// ── 公版歌词 ──────────────────────────────────────────────────────────────────

function PublicLyricsPanel() {
  const [items, setItems] = useState<PublicLyric[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [mood, setMood] = useState("");
  const [scene, setScene] = useState("");
  const [style, setStyle] = useState("");
  const [commercial, setCommercial] = useState("");
  const [selected, setSelected] = useState<PublicLyric | null>(null);
  const [msg, setMsg] = useState("");
  const [queue, setQueue] = useState<SeedProgress | null>(null);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (mood) params.set("mood", mood);
    if (scene) params.set("scene", scene);
    if (style) params.set("style", style);
    if (commercial) params.set("commercial", commercial);
    const data = await fetch(`/api/music-module/public?${params}`).then((r) => r.json());
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
  }, [q, category, mood, scene, style, commercial]);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/music-module/public/sync");
      if (!res.ok) return;
      const data = await res.json();
      setQueue(data.queue ?? null);
    } catch {
      /* 队列表未迁移或暂不可用时忽略 */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function openDetail(id: string) {
    const data = await fetch(`/api/music-module/public/${id}`).then((r) => r.json());
    setSelected(data.lyric ?? null);
  }

  const Chip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">公版歌词库</h2>
          <p className="mt-0.5 text-xs text-[var(--text-caption)]">
            唯一入库方式：粘贴 ChatGPT 会员输出的曲目清单 → 平台提取、抓取、评分标记入库（≥{MIN_PUBLIC_OVERALL_SCORE} 分）
            {queue ? ` · 已导入 ${queue.total} 首（已入库 ${queue.ingested} / 待处理 ${queue.pending}）` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs text-white"
        >
          <FiClipboard className="h-3.5 w-3.5" /> 粘贴导入并入库
        </button>
      </div>

      {showImport && (
        <ImportPasteModal
          onClose={() => setShowImport(false)}
          onDone={async (summary) => {
            setShowImport(false);
            setMsg(summary);
            await load();
            await loadQueue();
          }}
        />
      )}

      {msg && (
        <p className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-4 py-2 text-sm text-[var(--text-secondary)]">
          {msg}
        </p>
      )}

      {/* 搜索 */}
      <div className="relative mt-4 max-w-md">
        <FiSearch className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-caption)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索标题 / 作者 / 歌词"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] py-2 pl-9 pr-3 text-sm"
        />
      </div>

      {/* 主题筛选 */}
      <div className="mt-3">
        <p className="mb-1 text-xs text-[var(--text-caption)]">主题</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip label="全部" active={!category} onClick={() => setCategory("")} />
          {PUBLIC_CATEGORIES.map((c) => (
            <Chip key={c} label={c} active={category === c} onClick={() => setCategory(category === c ? "" : c)} />
          ))}
        </div>
      </div>

      {/* 标签筛选 */}
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <TagRow label="情绪" tags={MOOD_TAGS} value={mood} onChange={setMood} />
        <TagRow label="场景" tags={SCENE_TAGS} value={scene} onChange={setScene} />
        <TagRow label="风格" tags={STYLE_TAGS} value={style} onChange={setStyle} />
        <TagRow label="商业" tags={COMMERCIAL_TAGS} value={commercial} onChange={setCommercial} />
      </div>

      <p className="mt-4 text-xs text-[var(--text-caption)]">共 {total} 首</p>

      {/* 列表 + 详情 */}
      <div className="mt-2 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {items.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => void openDetail(l.id)}
              className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-[var(--bg-inset)] ${
                selected?.id === l.id ? "border-[var(--accent)]" : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{l.title}</span>
                  {l.titleZh && <p className="text-xs text-[var(--text-caption)]">中文：{l.titleZh}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="rounded bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                    {l.overallScore} 分
                  </span>
                  {l.coverHotness && (
                    <span className="text-[10px] text-amber-500">{l.coverHotness}</span>
                  )}
                  <span className="rounded bg-[var(--bg-inset)] px-1.5 py-0.5 text-[10px]">{l.category}</span>
                </div>
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-caption)]">
                {l.author || "佚名"}
                {l.country ? ` · ${l.country}` : ""}
                {l.language ? ` · ${l.language}` : ""}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {[...l.commercialTags, ...l.moodTags, ...l.sceneTags, ...l.styleTags].slice(0, 8).map((t, idx) => (
                  <span key={`${t}-${idx}`} className="rounded bg-[var(--bg-inset)] px-1.5 py-0.5 text-[10px] text-[var(--text-caption)]">
                    {t}
                  </span>
                ))}
              </div>
            </button>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-[var(--text-caption)]">暂无歌词，点击「立即同步」让 GPT 自动收录</p>
          )}
        </div>

        {selected && (
          <div className="rounded-xl border border-[var(--border)] p-4 lg:sticky lg:top-0 lg:self-start">
            <h3 className="text-base font-semibold">{selected.title}</h3>
            {selected.titleZh && (
              <p className="mt-0.5 text-sm text-[var(--text-secondary)]">中文歌名：{selected.titleZh}</p>
            )}
            <p className="mt-0.5 text-xs text-[var(--text-caption)]">
              {selected.author || "佚名"}
              {selected.birthYear || selected.deathYear ? `（${selected.birthYear ?? "?"}–${selected.deathYear ?? "?"}）` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
              <span className="rounded bg-[var(--accent)]/15 px-2 py-0.5 font-semibold text-[var(--accent)]">
                综合 {selected.overallScore} 分
              </span>
              {selected.coverHotness && (
                <span className="text-amber-500">翻唱热度 {selected.coverHotness}</span>
              )}
              <span className="rounded bg-[var(--bg-inset)] px-1.5 py-0.5">{selected.category}</span>
              {selected.language && <span className="rounded bg-[var(--bg-inset)] px-1.5 py-0.5">{selected.language}</span>}
              {selected.firstPublished && <span className="rounded bg-[var(--bg-inset)] px-1.5 py-0.5">{selected.firstPublished}</span>}
            </div>
            {selected.commercialTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selected.commercialTags.map((t) => (
                  <span key={t} className="rounded border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-1.5 py-0.5 text-[10px] text-[var(--accent)]">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {selected.scoreDetails?.coverAnalysis?.includeReason && (
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                <span className="font-medium text-[var(--text-caption)]">收录理由：</span>
                {selected.scoreDetails.coverAnalysis.includeReason}
              </p>
            )}
            <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{selected.body}</pre>
            {selected.lyricZhRemark && (
              <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-inset)] p-3">
                <p className="mb-1 text-xs font-semibold text-[var(--text-caption)]">中文备注</p>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">{selected.lyricZhRemark}</pre>
              </div>
            )}
            {selected.sourceUrl && (
              <p className="mt-3 text-xs">
                来源：
                <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">
                  {selected.sourceUrl}
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type ImportPreviewTrack = {
  id: string;
  title: string;
  author: string;
  category: string;
  sourceUrl: string;
  language: string;
  note: string;
};

function ImportPasteModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (summary: string) => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  const [tracks, setTracks] = useState<ImportPreviewTrack[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [method, setMethod] = useState<"json" | "gpt" | "">("");
  const [busy, setBusy] = useState<"extract" | "confirm" | null>(null);
  const [err, setErr] = useState("");

  async function extract() {
    setBusy("extract");
    setErr("");
    setTracks([]);
    setWarnings([]);
    setMethod("");
    try {
      const res = await fetch("/api/music-module/public/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extract", text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "提取失败");
      setTracks(data.tracks ?? []);
      setWarnings(data.warnings ?? []);
      setMethod(data.method ?? "");
      if (!data.tracks?.length) setErr("未识别到曲目，请检查粘贴内容");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    if (!tracks.length) return;
    setBusy("confirm");
    setErr("");
    try {
      const res = await fetch("/api/music-module/public/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", tracks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "导入失败");
      const s = data.saved;
      const sync = data.syncResult as
        | { added?: number; rejectedScore?: number; skipped?: number; failed?: number }
        | undefined;
      const parts = [`曲目入库：新增 ${s.added}，更新 ${s.updated}，跳过 ${s.skipped}`];
      if (sync) {
        parts.push(`抓取解析：入库 ${sync.added} 首`);
        if (sync.rejectedScore) parts.push(`评分未达标 ${sync.rejectedScore} 首`);
        if (sync.skipped) parts.push(`跳过 ${sync.skipped} 首`);
        if (sync.failed) parts.push(`失败 ${sync.failed} 首`);
      }
      await onDone(`${parts.join("；")}。`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 className="text-base font-semibold">粘贴导入公版曲目</h3>
            <p className="mt-0.5 text-xs text-[var(--text-caption)]">
              在 ChatGPT 会员里生成公版曲目名单，整段粘贴到下方 → 提取预览 → 确认并入库（平台自动抓取、评分标记）。
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--bg-inset)]">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`粘贴 ChatGPT 输出，支持：\n· JSON / Markdown 代码块\n· 表格、编号列表、自然语言列表\n\n建议每项包含：曲名、作者、来源链接（Wikipedia/Hymnary）`}
            className="h-40 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3 text-sm leading-relaxed"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!text.trim() || busy !== null}
              onClick={() => void extract()}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy === "extract" ? "提取中…" : "提取预览"}
            </button>
            {tracks.length > 0 && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void confirm()}
                className="rounded-lg border border-[var(--accent)] px-4 py-2 text-sm text-[var(--accent)] disabled:opacity-50"
              >
                {busy === "confirm" ? "入库中…" : `确认并入库（${tracks.length} 首）`}
              </button>
            )}
          </div>
          {method && (
            <p className="mt-2 text-xs text-[var(--text-caption)]">
              提取方式：{method === "json" ? "JSON 解析（免 API）" : "GPT 结构化提取（1 次 API）"}
            </p>
          )}
          {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
          {warnings.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-amber-600">
              {warnings.slice(0, 8).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {tracks.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-inset)] text-[var(--text-caption)]">
                  <tr>
                    <th className="px-3 py-2">曲名</th>
                    <th className="px-3 py-2">作者</th>
                    <th className="px-3 py-2">分类</th>
                    <th className="px-3 py-2">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((t) => (
                    <tr key={t.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2 font-medium">{t.title}</td>
                      <td className="px-3 py-2">{t.author}</td>
                      <td className="px-3 py-2">{t.category}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-[var(--text-caption)]">
                        {t.sourceUrl || "（无链接）"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TagRow({
  label,
  tags,
  value,
  onChange,
}: {
  label: string;
  tags: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-xs text-[var(--text-caption)]">{label}</span>
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(value === t ? "" : t)}
            className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
              value === t
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 原创歌词 ──────────────────────────────────────────────────────────────────

const EMPTY_PROMPT: OriginalPrompt = {
  theme: "",
  language: "zh",
  style: "",
  mood: "",
  keywords: "",
  length: "medium",
  extra: "",
};

function OriginalLyricsPanel() {
  const [list, setList] = useState<OriginalLyric[]>([]);
  const [prompt, setPrompt] = useState<OriginalPrompt>(EMPTY_PROMPT);
  const [current, setCurrent] = useState<OriginalLyric | null>(null);
  const [editorBody, setEditorBody] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [lyricZhRemark, setLyricZhRemark] = useState("");
  const [versions, setVersions] = useState<OriginalVersion[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [reviseText, setReviseText] = useState("");

  const loadList = useCallback(async () => {
    const data = await fetch("/api/music-module/original").then((r) => r.json());
    setList(data.items ?? []);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function openLyric(id: string) {
    const data = await fetch(`/api/music-module/original/${id}`).then((r) => r.json());
    setCurrent(data.lyric);
    setEditorBody(data.lyric?.body ?? "");
    setEditorTitle(data.lyric?.title ?? "");
    setTitleZh(data.lyric?.titleZh ?? "");
    setLyricZhRemark(data.lyric?.lyricZhRemark ?? "");
    setVersions(data.versions ?? []);
  }

  async function generate() {
    if (!prompt.theme && !prompt.keywords) {
      setMsg("请至少填写主题或关键词");
      return;
    }
    setBusy(true);
    setMsg("GPT 创作中…");
    try {
      const data = await fetch("/api/music-module/original", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompt),
      }).then((r) => r.json());
      if (data.error) {
        setMsg(data.error);
      } else {
        setMsg("创作完成");
        await loadList();
        await openLyric(data.lyric.id);
      }
    } finally {
      setBusy(false);
    }
  }

  async function action(path: string, body?: unknown, label = "处理中…") {
    if (!current) return;
    setBusy(true);
    setMsg(label);
    try {
      const data = await fetch(`/api/music-module/original/${current.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      }).then((r) => r.json());
      if (data.error) {
        setMsg(data.error);
      } else {
        setMsg("完成");
        if (typeof data.body === "string") setEditorBody(data.body);
        setVersions(data.versions ?? versions);
      }
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!current) return;
    setBusy(true);
    setMsg("保存中…");
    try {
      const data = await fetch(`/api/music-module/original/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editorBody, title: editorTitle }),
      }).then((r) => r.json());
      setVersions(data.versions ?? versions);
      setMsg("已保存为新版本");
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof OriginalPrompt, label: string, placeholder = "") => (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-[var(--text-caption)]">{label}</span>
      <input
        value={(prompt[key] as string) ?? ""}
        onChange={(e) => setPrompt({ ...prompt, [key]: e.target.value })}
        placeholder={placeholder}
        className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-sm"
      />
    </label>
  );

  return (
    <div className="grid h-full grid-cols-1 gap-4 p-6 lg:grid-cols-[280px_1fr_200px]">
      {/* 提示词 + 列表 */}
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="mb-2 text-sm font-semibold">提示词</h3>
          <div className="grid grid-cols-2 gap-2">
            {field("theme", "主题", "如：夏日海边")}
            {field("keywords", "关键词", "逗号分隔")}
            {field("style", "风格", "流行/民谣…")}
            {field("mood", "情绪", "温暖/激昂…")}
            {field("language", "语言", "zh/en/ja…")}
            {field("length", "长度", "short/medium/long")}
          </div>
          <label className="mt-2 flex flex-col gap-1 text-xs">
            <span className="text-[var(--text-caption)]">其它要求</span>
            <textarea
              value={prompt.extra ?? ""}
              onChange={(e) => setPrompt({ ...prompt, extra: e.target.value })}
              rows={2}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy}
            className="mt-3 w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            生成歌词
          </button>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--text-caption)]">我的原创</p>
          <div className="space-y-1">
            {list.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => void openLyric(l.id)}
                className={`block w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--bg-inset)] ${
                  current?.id === l.id ? "bg-[var(--bg-inset)] font-medium" : ""
                }`}
              >
                {l.title}
                {l.titleZh && <span className="block truncate text-[10px] text-[var(--text-caption)]">中文：{l.titleZh}</span>}
              </button>
            ))}
            {list.length === 0 && <p className="text-xs text-[var(--text-caption)]">还没有原创歌词</p>}
          </div>
        </div>
      </div>

      {/* 编辑器 */}
      <div className="flex min-h-0 flex-col">
        {msg && <p className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-4 py-2 text-sm">{msg}</p>}
        {current ? (
          <>
            <input
              value={editorTitle}
              onChange={(e) => setEditorTitle(e.target.value)}
              className="mb-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-base font-semibold"
            />
            {titleZh && (
              <p className="mb-2 px-3 text-xs text-[var(--text-caption)]">中文歌名：{titleZh}</p>
            )}
            <textarea
              value={editorBody}
              onChange={(e) => setEditorBody(e.target.value)}
              className="min-h-[240px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-4 py-3 font-mono text-sm leading-relaxed"
            />
            {lyricZhRemark && (
              <div className="mt-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-inset)] p-3">
                <p className="mb-1 text-xs font-semibold text-[var(--text-caption)]">中文备注</p>
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">{lyricZhRemark}</pre>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void save()} disabled={busy} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-60">
                保存
              </button>
              <button type="button" onClick={() => void action("regenerate", undefined, "重新生成中…")} disabled={busy} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
                重新生成
              </button>
              <button type="button" onClick={() => void action("continue", undefined, "继续创作中…")} disabled={busy} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
                继续创作
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={reviseText}
                onChange={(e) => setReviseText(e.target.value)}
                placeholder="修改要求，如：副歌更押韵"
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => { if (reviseText) void action("revise", { instruction: reviseText }, "修改中…"); }}
                disabled={busy || !reviseText}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-60"
              >
                修改
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-caption)]">
            填写提示词生成歌词，或从左侧选择已有原创
          </div>
        )}
      </div>

      {/* 历史版本 */}
      <div className="rounded-xl border border-[var(--border)] p-3">
        <p className="mb-2 text-xs font-semibold text-[var(--text-caption)]">历史版本</p>
        <div className="space-y-1">
          {versions.map((v) => (
            <div key={v.id} className="rounded px-2 py-1.5 text-xs" title={v.contentPreview}>
              <span className="font-medium">v{v.versionNo}</span> · {v.note}
              <span className="block text-[10px] text-[var(--text-caption)]">
                {new Date(v.createdAt).toLocaleString()} · {v.createdBy}
              </span>
            </div>
          ))}
          {versions.length === 0 && <p className="text-xs text-[var(--text-caption)]">—</p>}
        </div>
      </div>
    </div>
  );
}
