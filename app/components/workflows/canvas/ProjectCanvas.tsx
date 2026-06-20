"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiUser,
  FiZoomIn,
  FiZoomOut,
  FiMaximize,
  FiImage,
  FiLoader,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { useT2VWorkbenchStore } from "@/app/lib/workbench-persist/t2v-store";
import { fileToScaledDataUrl } from "@/app/lib/image-client";

type Character = {
  id: string;
  name: string;
  appearance: string;
  refImageUrl: string | null;
  createdAt: string;
};

const SHOT_W = 220;
const SHOT_H = 210;
const CHAR_W = 170;
const CHAR_H = 220;
const REF_W = 180;
const REF_H = 180;
const GAP = 48;
const MM_W = 168;
const MM_H = 112;

type Mode = "pan" | "card" | "link" | "marquee" | null;
type Rect = { x: number; y: number; w: number; h: number };

function sizeOf(key: string) {
  if (key.startsWith("char-")) return { w: CHAR_W, h: CHAR_H };
  if (key.startsWith("ref-")) return { w: REF_W, h: REF_H };
  return { w: SHOT_W, h: SHOT_H };
}
function rectsIntersect(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export default function ProjectCanvas() {
  const { state, patch } = useT2VWorkbenchStore();
  const { director, characterIds, canvasLinks, canvasRefs } = state;

  const [chars, setChars] = useState<Character[]>([]);
  const [pan, setPan] = useState({ x: 40, y: 24 });
  const [zoom, setZoom] = useState(1);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    state.canvasPositions
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [linking, setLinking] = useState(false);
  const [tempLink, setTempLink] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const [framing, setFraming] = useState<Record<number, boolean>>({});
  const [frameErr, setFrameErr] = useState<Record<number, string>>({});
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const modeRef = useRef<Mode>(null);
  const dragRef = useRef<{ sm: { x: number; y: number }; start: Record<string, { x: number; y: number }> } | null>(null);
  const panRef = useRef<{ sm: { x: number; y: number }; sp: { x: number; y: number } } | null>(null);
  const linkRef = useRef<{ charId: string } | null>(null);
  const marqueeRef = useRef<{ sx: number; sy: number } | null>(null);

  const zoomRef = useRef(zoom);
  const panStateRef = useRef(pan);
  const positionsRef = useRef(positions);
  const selectedRef = useRef(selected);
  useEffect(() => {
    zoomRef.current = zoom;
    panStateRef.current = pan;
    positionsRef.current = positions;
    selectedRef.current = selected;
  });

  const importedChars = chars.filter((c) => characterIds.includes(c.id));
  const shots = director?.prompts ?? [];

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/characters");
      const data = await res.json();
      if (res.ok) setChars(data.characters ?? []);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const defaultPos = useCallback(
    (key: string): { x: number; y: number } => {
      if (key.startsWith("char-")) {
        const i = importedChars.findIndex((c) => `char-${c.id}` === key);
        return { x: 40 + Math.max(0, i) * (CHAR_W + GAP), y: 40 };
      }
      if (key.startsWith("ref-")) {
        const i = canvasRefs.findIndex((r) => `ref-${r.id}` === key);
        return { x: 40 + Math.max(0, i) * (REF_W + GAP), y: 40 + CHAR_H + 90 + SHOT_H + 70 };
      }
      const i = Number(key.replace("shot-", "")) || 0;
      return { x: 40 + i * (SHOT_W + GAP), y: 40 + CHAR_H + 90 };
    },
    [importedChars, canvasRefs]
  );
  const posOf = useCallback(
    (key: string) => positions[key] ?? defaultPos(key),
    [positions, defaultPos]
  );

  const allKeys = [
    ...importedChars.map((c) => `char-${c.id}`),
    ...shots.map((_, i) => `shot-${i}`),
    ...canvasRefs.map((r) => `ref-${r.id}`),
  ];

  const centerScreen = (key: string, w: number, h: number) => {
    const p = posOf(key);
    return { x: pan.x + (p.x + w / 2) * zoom, y: pan.y + (p.y + h / 2) * zoom };
  };
  const charConnectorScreen = (id: string) => {
    const p = posOf(`char-${id}`);
    return { x: pan.x + (p.x + CHAR_W) * zoom, y: pan.y + (p.y + CHAR_H / 2) * zoom };
  };

  function castCharacter(charId: string, shotIdx: number) {
    if (!director) return;
    if (canvasLinks.some((l) => l.charId === charId && l.shotIdx === shotIdx)) return;
    const ch = chars.find((c) => c.id === charId);
    if (!ch) return;
    const cur = (director.prompts[shotIdx]?.providerPrompt ?? "").trim();
    const token = `@${ch.name}`;
    const next = cur.includes(token) ? cur : cur ? `${cur.replace(/\.\s*$/, "")}, ${token}.` : token;
    patch({
      director: {
        ...director,
        prompts: director.prompts.map((p, i) => (i === shotIdx ? { ...p, providerPrompt: next } : p)),
      },
      canvasLinks: [...canvasLinks, { charId, shotIdx }],
    });
  }
  function removeLink(charId: string, shotIdx: number) {
    patch({ canvasLinks: canvasLinks.filter((l) => !(l.charId === charId && l.shotIdx === shotIdx)) });
  }

  async function generateFrame(i: number) {
    if (!director) return;
    const prompt = director.prompts[i]?.providerPrompt;
    if (!prompt?.trim() || framing[i]) return;
    setFraming((f) => ({ ...f, [i]: true }));
    setFrameErr((e) => ({ ...e, [i]: "" }));
    try {
      const res = await fetch("/api/director/shot-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "首帧生成失败");
      patch({ shotFrames: { ...state.shotFrames, [i]: data.url as string } });
    } catch (err) {
      setFrameErr((e) => ({ ...e, [i]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setFraming((f) => ({ ...f, [i]: false }));
    }
  }

  // 删除选中：参考图便签→删除；角色卡→移出项目；分镜卡→忽略（不破坏剧本）
  const deleteSelected = useCallback(() => {
    const sel = selectedRef.current;
    if (sel.size === 0) return;
    const refIds = canvasRefs.filter((r) => sel.has(`ref-${r.id}`)).map((r) => r.id);
    const charRemove = Array.from(sel).filter((k) => k.startsWith("char-")).map((k) => k.slice(5));
    const nextRefs = canvasRefs.filter((r) => !refIds.includes(r.id));
    const nextCharIds = characterIds.filter((id) => !charRemove.includes(id));
    const nextLinks = canvasLinks.filter((l) => !charRemove.includes(l.charId));
    patch({ canvasRefs: nextRefs, characterIds: nextCharIds, canvasLinks: nextLinks });
    setSelected(new Set());
  }, [canvasRefs, characterIds, canvasLinks, patch]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedRef.current.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.key === "Escape") {
        setSelected(new Set());
        setMenu(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected]);

  // 全局拖拽/连线/框选
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const mode = modeRef.current;
      if (mode === "pan" && panRef.current) {
        const { sm, sp } = panRef.current;
        setPan({ x: sp.x + (e.clientX - sm.x), y: sp.y + (e.clientY - sm.y) });
      } else if (mode === "card" && dragRef.current) {
        const { sm, start } = dragRef.current;
        const z = zoomRef.current;
        const dx = (e.clientX - sm.x) / z;
        const dy = (e.clientY - sm.y) / z;
        setPositions((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(start)) next[k] = { x: start[k].x + dx, y: start[k].y + dy };
          return next;
        });
      } else if (mode === "link") {
        const r = viewportRef.current?.getBoundingClientRect();
        if (r) setTempLink((t) => (t ? { ...t, to: { x: e.clientX - r.left, y: e.clientY - r.top } } : t));
      } else if (mode === "marquee" && marqueeRef.current) {
        const r = viewportRef.current?.getBoundingClientRect();
        if (r) setMarquee({ x0: marqueeRef.current.sx, y0: marqueeRef.current.sy, x1: e.clientX - r.left, y1: e.clientY - r.top });
      }
    }
    function onUp(e: MouseEvent) {
      const mode = modeRef.current;
      if (mode === "card") {
        patch({ canvasPositions: positionsRef.current });
      } else if (mode === "link" && linkRef.current) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const shotEl = el?.closest("[data-shot-idx]") as HTMLElement | null;
        if (shotEl?.dataset.shotIdx != null) castCharacter(linkRef.current.charId, Number(shotEl.dataset.shotIdx));
        setLinking(false);
        setTempLink(null);
      } else if (mode === "marquee" && marqueeRef.current) {
        const r = viewportRef.current?.getBoundingClientRect();
        if (r) {
          const mx0 = Math.min(marqueeRef.current.sx, e.clientX - r.left);
          const my0 = Math.min(marqueeRef.current.sy, e.clientY - r.top);
          const mw = Math.abs(e.clientX - r.left - marqueeRef.current.sx);
          const mh = Math.abs(e.clientY - r.top - marqueeRef.current.sy);
          const box: Rect = { x: mx0, y: my0, w: mw, h: mh };
          const z = zoomRef.current;
          const p = panStateRef.current;
          const hit = new Set<string>();
          for (const k of allKeys) {
            const pos = positionsRef.current[k] ?? defaultPos(k);
            const s = sizeOf(k);
            const cardRect: Rect = { x: p.x + pos.x * z, y: p.y + pos.y * z, w: s.w * z, h: s.h * z };
            if (rectsIntersect(box, cardRect)) hit.add(k);
          }
          setSelected(hit);
        }
        setMarquee(null);
      }
      modeRef.current = null;
      dragRef.current = null;
      panRef.current = null;
      linkRef.current = null;
      marqueeRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director, chars, canvasLinks, canvasRefs, characterIds, allKeys.join(",")]);

  // 滚轮缩放（围绕光标）
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const r = el!.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const z = zoomRef.current;
      const p = panStateRef.current;
      const nz = Math.min(2, Math.max(0.2, z * (1 - e.deltaY * 0.0015)));
      setPan({ x: mx - ((mx - p.x) / z) * nz, y: my - ((my - p.y) / z) * nz });
      setZoom(nz);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onCardDown(e: React.MouseEvent, key: string) {
    e.stopPropagation();
    setMenu(null);
    let sel = new Set(selectedRef.current);
    if (e.shiftKey) {
      if (sel.has(key)) sel.delete(key);
      else sel.add(key);
    } else if (!sel.has(key)) {
      sel = new Set([key]);
    }
    setSelected(sel);
    const start: Record<string, { x: number; y: number }> = {};
    for (const k of sel) start[k] = posOf(k);
    if (!sel.has(key)) start[key] = posOf(key);
    modeRef.current = "card";
    dragRef.current = { sm: { x: e.clientX, y: e.clientY }, start };
  }
  function onBgDown(e: React.MouseEvent) {
    setMenu(null);
    const r = viewportRef.current?.getBoundingClientRect();
    if ((e.shiftKey || e.metaKey || e.ctrlKey) && r) {
      modeRef.current = "marquee";
      marqueeRef.current = { sx: e.clientX - r.left, sy: e.clientY - r.top };
      setMarquee({ x0: e.clientX - r.left, y0: e.clientY - r.top, x1: e.clientX - r.left, y1: e.clientY - r.top });
    } else {
      setSelected(new Set());
      modeRef.current = "pan";
      panRef.current = { sm: { x: e.clientX, y: e.clientY }, sp: pan };
    }
  }
  function startLink(e: React.MouseEvent, charId: string) {
    e.stopPropagation();
    modeRef.current = "link";
    linkRef.current = { charId };
    setLinking(true);
    const from = charConnectorScreen(charId);
    setTempLink({ from, to: from });
  }

  function fitToContent() {
    const el = viewportRef.current;
    if (!el || allKeys.length === 0) {
      setZoom(1);
      setPan({ x: 40, y: 24 });
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const k of allKeys) {
      const p = posOf(k);
      const s = sizeOf(k);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + s.w);
      maxY = Math.max(maxY, p.y + s.h);
    }
    const pad = 60;
    const cw = maxX - minX + pad * 2;
    const ch = maxY - minY + pad * 2;
    const r = el.getBoundingClientRect();
    const nz = Math.min(2, Math.max(0.2, Math.min(r.width / cw, r.height / ch)));
    setZoom(nz);
    setPan({ x: r.width / 2 - (minX + (maxX - minX) / 2) * nz, y: r.height / 2 - (minY + (maxY - minY) / 2) * nz });
  }

  async function addReference(file: File | undefined | null) {
    setMenu(null);
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const dataUrl = await fileToScaledDataUrl(file, 1024);
      const res = await fetch("/api/assets/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "上传失败");
      const id = `${Date.now()}`;
      patch({ canvasRefs: [...canvasRefs, { id, url: data.url as string }] });
    } catch {
      /* ignore */
    }
  }

  // 小地图边界
  let bounds: Rect | null = null;
  if (allKeys.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const k of allKeys) {
      const p = posOf(k);
      const s = sizeOf(k);
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + s.w); maxY = Math.max(maxY, p.y + s.h);
    }
    bounds = { x: minX - 80, y: minY - 80, w: maxX - minX + 160, h: maxY - minY + 160 };
  }
  const mmScale = bounds ? Math.min(MM_W / bounds.w, MM_H / bounds.h) : 1;
  const vpRect = viewportRef.current?.getBoundingClientRect();

  function onMinimapClick(e: React.MouseEvent) {
    if (!bounds || !vpRect) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const wx = bounds.x + (e.clientX - r.left) / mmScale;
    const wy = bounds.y + (e.clientY - r.top) / mmScale;
    setPan({ x: vpRect.width / 2 - wx * zoom, y: vpRect.height / 2 - wy * zoom });
  }

  const hasContent = allKeys.length > 0;
  const marqueeBox = marquee
    ? { x: Math.min(marquee.x0, marquee.x1), y: Math.min(marquee.y0, marquee.y1), w: Math.abs(marquee.x1 - marquee.x0), h: Math.abs(marquee.y1 - marquee.y0) }
    : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--bg-inset)]">
      {/* 缩放控制 */}
      <div className="absolute right-4 top-4 z-30 flex flex-col gap-1.5">
        <button type="button" onClick={() => setZoom((z) => Math.min(2, z + 0.15))} className="btn-secondary rounded-lg p-2" title="放大"><FiZoomIn className="h-4 w-4" /></button>
        <button type="button" onClick={() => setZoom((z) => Math.max(0.2, z - 0.15))} className="btn-secondary rounded-lg p-2" title="缩小"><FiZoomOut className="h-4 w-4" /></button>
        <button type="button" onClick={fitToContent} className="btn-secondary rounded-lg p-2" title="适应全部内容"><FiMaximize className="h-4 w-4" /></button>
        <span className="mt-1 text-center text-[10px] text-[var(--text-caption)]">{Math.round(zoom * 100)}%</span>
      </div>

      {!hasContent && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-[var(--text-secondary)]">画布是空的</p>
            <p className="mt-1 text-xs text-[var(--text-caption)]">先到「视频创作」运行编导，分镜与角色会自动铺到这里</p>
            <a href="/ai-video" className="btn-primary mt-3 inline-block rounded-lg px-4 py-2 text-sm">去视频创作</a>
          </div>
        </div>
      )}

      <div
        ref={viewportRef}
        onMouseDown={onBgDown}
        onDoubleClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg) fitToContent(); }}
        onContextMenu={(e) => { e.preventDefault(); const r = viewportRef.current?.getBoundingClientRect(); if (r) setMenu({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} data-bg>
          {/* 角色卡 */}
          {importedChars.map((c) => {
            const key = `char-${c.id}`;
            const p = posOf(key);
            const sel = selected.has(key);
            return (
              <div
                key={c.id}
                onMouseDown={(e) => onCardDown(e, key)}
                className={`group absolute cursor-grab overflow-hidden rounded-xl border bg-[var(--bg-surface)] shadow-lg active:cursor-grabbing ${sel ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)]"}`}
                style={{ left: p.x, top: p.y, width: CHAR_W, height: CHAR_H }}
              >
                <div className="flex h-[150px] w-full items-center justify-center bg-black/30">
                  {c.refImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.refImageUrl} alt={c.name} className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <FiUser className="h-8 w-8 text-[var(--text-secondary)]" />
                  )}
                </div>
                <div className="px-2.5 py-1.5">
                  <span className="font-mono text-xs font-semibold text-[var(--accent)]">@{c.name}</span>
                  <p className="line-clamp-2 text-[10px] leading-snug text-[var(--text-caption)]">{c.appearance}</p>
                </div>
                <div
                  onMouseDown={(e) => startLink(e, c.id)}
                  title="拖到分镜 = 选角（注入 @角色名）"
                  className={`absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-[var(--accent)] shadow transition-opacity ${linking ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                />
              </div>
            );
          })}

          {/* 分镜卡 */}
          {shots.map((shot, i) => {
            const key = `shot-${i}`;
            const p = posOf(key);
            const sel = selected.has(key);
            const frameImg = state.shotFrames?.[i];
            const busy = framing[i];
            const sb = director?.storyboard?.[i];
            const zhSummary = [sb?.action, sb?.environment].filter(Boolean).join(" · ") || sb?.narration || "（无中文描述）";
            return (
              <div
                key={i}
                data-shot-idx={i}
                onMouseDown={(e) => onCardDown(e, key)}
                className={`group absolute cursor-grab overflow-hidden rounded-xl border bg-[var(--bg-surface)] shadow-lg active:cursor-grabbing ${sel ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : linking ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                style={{ left: p.x, top: p.y, width: SHOT_W, height: SHOT_H }}
              >
                <div className="flex items-center justify-between bg-[var(--bg-inset)] px-2.5 py-1">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">镜头 {i + 1}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => generateFrame(i)}
                      disabled={busy}
                      title="生成首帧（含已选角角色）"
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)] transition-opacity hover:bg-[var(--accent-soft)] disabled:opacity-50 ${busy ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    >
                      {busy ? <FiLoader className="h-3 w-3 animate-spin" /> : <FiImage className="h-3 w-3" />}
                      {busy ? "生成中" : frameImg ? "重生成" : "生成首帧"}
                    </button>
                    <span className="text-[10px] text-[var(--text-caption)]">{shot.duration}s</span>
                  </div>
                </div>
                {frameImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={frameImg} alt={`镜头${i + 1}`} className="h-[110px] w-full object-cover" draggable={false} />
                ) : null}
                <p title={shot.providerPrompt} className={`px-2.5 py-1.5 text-[11px] leading-snug text-[var(--text-secondary)] ${frameImg ? "line-clamp-2" : "line-clamp-5"}`}>
                  {zhSummary}
                </p>
                {frameErr[i] && <p className="px-2.5 text-[9px] leading-tight text-[var(--danger)] line-clamp-2">{frameErr[i]}</p>}
              </div>
            );
          })}

          {/* 参考图便签 */}
          {canvasRefs.map((r) => {
            const key = `ref-${r.id}`;
            const p = posOf(key);
            const sel = selected.has(key);
            return (
              <div
                key={r.id}
                onMouseDown={(e) => onCardDown(e, key)}
                className={`group absolute cursor-grab overflow-hidden rounded-lg border bg-[var(--bg-surface)] shadow-lg active:cursor-grabbing ${sel ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)]"}`}
                style={{ left: p.x, top: p.y, width: REF_W, height: REF_H }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.url} alt="参考图" className="h-full w-full object-cover" draggable={false} />
                <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white">参考</span>
              </div>
            );
          })}
        </div>

        {/* 连线层（屏幕坐标） */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {canvasLinks.map((l, idx) => {
            if (!chars.some((c) => c.id === l.charId) || l.shotIdx >= shots.length) return null;
            const a = charConnectorScreen(l.charId);
            const b = centerScreen(`shot-${l.shotIdx}`, SHOT_W, SHOT_H);
            return (
              <g key={idx}>
                <path d={`M ${a.x} ${a.y} C ${a.x + 60} ${a.y}, ${b.x - 60} ${b.y}, ${b.x} ${b.y}`} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={0.8} />
                <path className="pointer-events-auto cursor-pointer" d={`M ${a.x} ${a.y} C ${a.x + 60} ${a.y}, ${b.x - 60} ${b.y}, ${b.x} ${b.y}`} fill="none" stroke="transparent" strokeWidth={12} onDoubleClick={() => removeLink(l.charId, l.shotIdx)} />
                <circle className="pointer-events-auto cursor-pointer" cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={7} fill="var(--bg-surface)" stroke="var(--accent)" onClick={() => removeLink(l.charId, l.shotIdx)}>
                  <title>点击/双击连线移除选角</title>
                </circle>
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 3} textAnchor="middle" className="pointer-events-none" fontSize={9} fill="var(--accent)">×</text>
              </g>
            );
          })}
          {tempLink && (
            <path d={`M ${tempLink.from.x} ${tempLink.from.y} C ${tempLink.from.x + 60} ${tempLink.from.y}, ${tempLink.to.x - 60} ${tempLink.to.y}, ${tempLink.to.x} ${tempLink.to.y}`} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 4" />
          )}
          {marqueeBox && (
            <rect x={marqueeBox.x} y={marqueeBox.y} width={marqueeBox.w} height={marqueeBox.h} fill="var(--accent)" fillOpacity={0.1} stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 3" />
          )}
        </svg>
      </div>

      {/* 右键菜单 */}
      {menu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div className="absolute z-40 min-w-[150px] rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-1 shadow-xl" style={{ left: menu.x, top: menu.y }}>
            <button type="button" onClick={() => fileInput.current?.click()} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-inset)]"><FiPlus className="h-3.5 w-3.5" />添加参考图</button>
            <button type="button" onClick={() => { fitToContent(); setMenu(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-inset)]"><FiMaximize className="h-3.5 w-3.5" />适应全部内容</button>
            {selected.size > 0 && (
              <button type="button" onClick={() => { deleteSelected(); setMenu(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--danger)] hover:bg-[var(--bg-inset)]"><FiTrash2 className="h-3.5 w-3.5" />删除选中（{selected.size}）</button>
            )}
          </div>
        </>
      )}
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => addReference(e.target.files?.[0])} />

      {/* 小地图 */}
      {hasContent && bounds && vpRect && (
        <div className="absolute bottom-3 right-4 z-20 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]/90 shadow" style={{ width: MM_W, height: MM_H }} onClick={onMinimapClick}>
          <svg width={MM_W} height={MM_H} className="cursor-pointer">
            {allKeys.map((k) => {
              const p = posOf(k); const s = sizeOf(k);
              const isChar = k.startsWith("char-");
              return <rect key={k} x={(p.x - bounds!.x) * mmScale} y={(p.y - bounds!.y) * mmScale} width={s.w * mmScale} height={s.h * mmScale} fill={isChar ? "var(--accent)" : "var(--text-caption)"} opacity={0.7} rx={1} />;
            })}
            <rect x={(((-pan.x) / zoom) - bounds.x) * mmScale} y={(((-pan.y) / zoom) - bounds.y) * mmScale} width={(vpRect.width / zoom) * mmScale} height={(vpRect.height / zoom) * mmScale} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
          </svg>
        </div>
      )}

      {/* 底部提示 */}
      {hasContent && (
        <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[var(--bg-surface)]/90 px-4 py-1.5 text-[11px] text-[var(--text-caption)] shadow">
          拖空白平移 · 滚轮缩放 · Shift/⌘+拖框选 · 拖角色圆点到分镜=选角 · Delete 删除 · 右键加参考图
        </div>
      )}
    </div>
  );
}
