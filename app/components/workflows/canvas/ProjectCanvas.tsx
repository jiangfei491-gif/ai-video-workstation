"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useT2VWorkbenchStore, getT2VState } from "@/app/lib/workbench-persist/t2v-store";
import type { CanvasUiState } from "@/app/lib/workbench-persist/types";
import { playOrderIndex } from "@/app/lib/auto-edit/workbench-bridge";
import ImageGalleryLightbox, {
  findGalleryIndex,
  shotImageGalleryItems,
} from "@/app/components/workflows/shared/ImageGalleryLightbox";
import { fileToScaledDataUrl } from "@/app/lib/image-client";
import {
  aspectRatioCss,
  parseAspectRatioString,
} from "@/app/lib/generation-params";

type Character = {
  id: string;
  name: string;
  appearance: string;
  refImageUrl: string | null;
  createdAt: string;
};

const SHOT_W = 320;
const SHOT_HEADER_H = 44;
const SHOT_TEXT_H = 76;
const CHAR_W = 250;
const CHAR_H = 320;
const REF_W = 240;
const REF_H = 240;
const GAP = 48;
const MM_W = 168;
const MM_H = 112;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;

type Mode = "pan" | "card" | "link" | "marquee" | "section" | null;
type Rect = { x: number; y: number; w: number; h: number };

function computeShotCardHeight(aspectCss: string, cardWidth = SHOT_W): number {
  const parts = aspectCss.split("/").map((s) => parseFloat(s.trim()));
  const aw = parts[0] || 9;
  const ah = parts[1] || 16;
  const mediaH = (cardWidth * ah) / aw;
  return Math.round(SHOT_HEADER_H + mediaH + SHOT_TEXT_H);
}

function shotAspectCssForIndex(
  index: number,
  aspectRatio: string,
  customAspectRatio: string | undefined,
  shotImageMeta?: Record<number, { aspectRatio?: string }>
): string {
  const metaRatio = shotImageMeta?.[index]?.aspectRatio;
  if (metaRatio) {
    const { w, h } = parseAspectRatioString(metaRatio);
    return `${w} / ${h}`;
  }
  return aspectRatioCss(aspectRatio, customAspectRatio);
}

function rectsIntersect(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export default function ProjectCanvas({
  immersive = false,
  reserveBottomChrome = true,
  focusShotIndex = null,
  focusToken = 0,
  onFocusHandled,
}: {
  immersive?: boolean;
  /** immersive 模式下是否为底部 MiniTimeline 预留空白；融合视图传 false */
  reserveBottomChrome?: boolean;
  focusShotIndex?: number | null;
  focusToken?: number;
  onFocusHandled?: () => void;
}) {
  const { state, patch } = useT2VWorkbenchStore();
  const { director, characterIds, canvasLinks, canvasRefs, editSequence, canvasUi } = state;

  const [chars, setChars] = useState<Character[]>([]);
  const [pan, setPan] = useState(canvasUi.canvasPan);
  const [zoom, setZoom] = useState(canvasUi.canvasZoom);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    state.canvasPositions
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(canvasUi.canvasSelectedKeys)
  );
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [linking, setLinking] = useState(false);
  const [tempLink, setTempLink] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const [framing, setFraming] = useState<Record<number, boolean>>({});
  const [frameErr, setFrameErr] = useState<Record<number, string>>({});
  const [varying, setVarying] = useState<Record<number, boolean>>({});
  const [variants, setVariants] = useState<Record<number, { url: string; assetId: string }[]>>({});
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [sectionLive, setSectionLive] = useState<{ id: string; x: number; y: number } | null>(null);
  const sectionDragRef = useRef<{ id: string; sm: { x: number; y: number }; sp: { x: number; y: number } } | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const modeRef = useRef<Mode>(null);
  const dragRef = useRef<{ sm: { x: number; y: number }; start: Record<string, { x: number; y: number }> } | null>(null);
  const panRef = useRef<{ sm: { x: number; y: number }; sp: { x: number; y: number } } | null>(null);
  const linkRef = useRef<{ fromKey: string } | null>(null);
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

  const canvasUiPersistRef = useRef<number | null>(null);
  const persistCanvasViewport = useCallback(
    (partial: Partial<CanvasUiState>) => {
      const cur = getT2VState();
      patch({ canvasUi: { ...cur.canvasUi, ...partial } });
    },
    [patch]
  );

  useEffect(() => {
    if (focusShotIndex == null || !focusToken) return;
    const key = `shot-${focusShotIndex}`;
    const pos = positionsRef.current[key] ?? state.canvasPositions[key];
    const el = viewportRef.current;
    if (!pos || !el) return;

    const aspectCss = shotAspectCssForIndex(
      focusShotIndex,
      state.aspectRatio,
      state.customAspectRatio,
      state.shotImageMeta
    );
    const cardH = computeShotCardHeight(aspectCss);
    const z = zoomRef.current;
    const rect = el.getBoundingClientRect();
    setPan({
      x: rect.width / 2 - (pos.x + SHOT_W / 2) * z,
      y: rect.height / 2 - (pos.y + cardH / 2) * z,
    });
    setSelected(new Set([key]));
    patch({ activeShotIdx: focusShotIndex });
    persistCanvasViewport({ canvasSelectedKeys: [key], canvasPan: {
      x: rect.width / 2 - (pos.x + SHOT_W / 2) * z,
      y: rect.height / 2 - (pos.y + cardH / 2) * z,
    }});
    onFocusHandled?.();
  }, [focusShotIndex, focusToken, onFocusHandled, patch, persistCanvasViewport, state.aspectRatio, state.customAspectRatio, state.canvasPositions, state.shotImageMeta]);

  // 仓库位置变化时（含刷新后读出存档、跨标签同步）同步回本地，
  // 修复"首次渲染时仓库未水合 → 本地为空 → 刷新丢失已摆放位置"
  useEffect(() => {
    setPositions(state.canvasPositions);
  }, [state.canvasPositions]);

  useEffect(() => {
    if (canvasUiPersistRef.current) window.clearTimeout(canvasUiPersistRef.current);
    canvasUiPersistRef.current = window.setTimeout(() => {
      persistCanvasViewport({
        canvasPan: pan,
        canvasZoom: zoom,
        canvasSelectedKeys: [...selected],
      });
    }, 200);
    return () => {
      if (canvasUiPersistRef.current) window.clearTimeout(canvasUiPersistRef.current);
    };
  }, [pan, zoom, selected, persistCanvasViewport]);

  const didAutoFitRef = useRef(false);

  const importedChars = chars.filter((c) => characterIds.includes(c.id));
  const shots = director?.prompts ?? [];

  const frameGalleryItems = useMemo(
    () => shotImageGalleryItems(shots.length, state.shotFrames ?? {}, (i) => `镜头 ${i + 1}`),
    [shots.length, state.shotFrames]
  );

  const defaultShotAspectCss = aspectRatioCss(state.aspectRatio, state.customAspectRatio);
  const defaultShotCardH = useMemo(
    () => computeShotCardHeight(defaultShotAspectCss),
    [defaultShotAspectCss]
  );

  const sizeOf = useCallback(
    (key: string) => {
      if (key.startsWith("char-")) return { w: CHAR_W, h: CHAR_H };
      if (key.startsWith("ref-")) return { w: REF_W, h: REF_H };
      if (key.startsWith("shot-")) {
        const idx = Number(key.slice(5));
        const aspectCss = Number.isFinite(idx)
          ? shotAspectCssForIndex(idx, state.aspectRatio, state.customAspectRatio, state.shotImageMeta)
          : defaultShotAspectCss;
        return { w: SHOT_W, h: computeShotCardHeight(aspectCss) };
      }
      return { w: SHOT_W, h: defaultShotCardH };
    },
    [state.aspectRatio, state.customAspectRatio, state.shotImageMeta, defaultShotAspectCss, defaultShotCardH]
  );

  const openFramePreview = useCallback(
    (url: string) => {
      if (!frameGalleryItems.length) return;
      setGalleryIndex(findGalleryIndex(frameGalleryItems, url));
    },
    [frameGalleryItems]
  );

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
        return { x: 40 + Math.max(0, i) * (REF_W + GAP), y: 40 + CHAR_H + 90 + defaultShotCardH + 70 };
      }
      const i = Number(key.replace("shot-", "")) || 0;
      return { x: 40 + i * (SHOT_W + GAP), y: 40 + CHAR_H + 90 };
    },
    [importedChars, canvasRefs, defaultShotCardH]
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
  const charConnectorScreen = (id: string) => handleScreen(`char-${id}`);
  function handleScreen(key: string) {
    const p = posOf(key);
    const s = sizeOf(key);
    return { x: pan.x + (p.x + s.w) * zoom, y: pan.y + (p.y + s.h / 2) * zoom };
  }
  function cardCenterScreen(key: string) {
    const p = posOf(key);
    const s = sizeOf(key);
    return { x: pan.x + (p.x + s.w / 2) * zoom, y: pan.y + (p.y + s.h / 2) * zoom };
  }
  function keyExists(key: string) {
    if (key.startsWith("char-")) return importedChars.some((c) => `char-${c.id}` === key);
    if (key.startsWith("ref-")) return canvasRefs.some((r) => `ref-${r.id}` === key);
    if (key.startsWith("shot-")) return Number(key.slice(5)) < shots.length;
    return false;
  }
  function addEdge(from: string, to: string) {
    if (from === to) return;
    if (state.canvasEdges.some((ed) => (ed.from === from && ed.to === to) || (ed.from === to && ed.to === from))) return;
    patch({ canvasEdges: [...state.canvasEdges, { id: `${Date.now()}`, from, to }] });
  }
  function removeEdge(id: string) {
    patch({ canvasEdges: state.canvasEdges.filter((ed) => ed.id !== id) });
  }

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

  async function callShotFrame(i: number, count: number) {
    const prompt = director?.prompts[i]?.providerPrompt;
    if (!prompt?.trim()) throw new Error("缺少提示词");
    const res = await fetch("/api/director/shot-frame", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, count, style: state.projectStyle }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "首帧生成失败");
    return (data.frames ?? []) as { url: string; assetId: string }[];
  }

  function adoptFrame(i: number, f: { url: string; assetId: string }) {
    patch({
      shotFrames: { ...state.shotFrames, [i]: f.url },
      shotFrameAssets: { ...state.shotFrameAssets, [i]: f.assetId },
    });
  }

  async function generateFrame(i: number) {
    if (!director || framing[i]) return;
    setFraming((f) => ({ ...f, [i]: true }));
    setFrameErr((e) => ({ ...e, [i]: "" }));
    try {
      const frames = await callShotFrame(i, 1);
      if (frames[0]) adoptFrame(i, frames[0]);
    } catch (err) {
      setFrameErr((e) => ({ ...e, [i]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setFraming((f) => ({ ...f, [i]: false }));
    }
  }

  // 变体扇出：一次生成 3 个候选首帧，点选采用
  async function generateVariants(i: number) {
    if (!director || varying[i]) return;
    setVarying((v) => ({ ...v, [i]: true }));
    setFrameErr((e) => ({ ...e, [i]: "" }));
    try {
      const frames = await callShotFrame(i, 3);
      setVariants((v) => ({ ...v, [i]: frames }));
    } catch (err) {
      setFrameErr((e) => ({ ...e, [i]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setVarying((v) => ({ ...v, [i]: false }));
    }
  }

  // 分区
  function addSection(canvasX: number, canvasY: number) {
    const id = `${Date.now()}`;
    patch({
      canvasSections: [
        ...state.canvasSections,
        { id, title: "分区", x: canvasX, y: canvasY, w: 520, h: 360 },
      ],
    });
  }
  function updateSection(id: string, p: Partial<{ title: string; x: number; y: number; w: number; h: number }>) {
    patch({
      canvasSections: state.canvasSections.map((s) => (s.id === id ? { ...s, ...p } : s)),
    });
  }
  function removeSection(id: string) {
    patch({ canvasSections: state.canvasSections.filter((s) => s.id !== id) });
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
      } else if (mode === "section" && sectionDragRef.current) {
        const { id, sm, sp } = sectionDragRef.current;
        const z = zoomRef.current;
        setSectionLive({ id, x: sp.x + (e.clientX - sm.x) / z, y: sp.y + (e.clientY - sm.y) / z });
      }
    }
    function onUp(e: MouseEvent) {
      const mode = modeRef.current;
      if (mode === "card") {
        patch({ canvasPositions: positionsRef.current });
      } else if (mode === "link" && linkRef.current) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const targetEl = el?.closest("[data-card-key]") as HTMLElement | null;
        const toKey = targetEl?.dataset.cardKey;
        const fromKey = linkRef.current.fromKey;
        if (toKey && toKey !== fromKey) {
          if (fromKey.startsWith("char-") && toKey.startsWith("shot-")) {
            castCharacter(fromKey.slice(5), Number(toKey.slice(5)));
          } else if (fromKey.startsWith("shot-") && toKey.startsWith("char-")) {
            castCharacter(toKey.slice(5), Number(fromKey.slice(5)));
          } else {
            addEdge(fromKey, toKey);
          }
        }
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
      } else if (mode === "section" && sectionDragRef.current) {
        const { id, sm, sp } = sectionDragRef.current;
        const z = zoomRef.current;
        updateSection(id, { x: sp.x + (e.clientX - sm.x) / z, y: sp.y + (e.clientY - sm.y) / z });
        setSectionLive(null);
      }
      modeRef.current = null;
      dragRef.current = null;
      panRef.current = null;
      linkRef.current = null;
      marqueeRef.current = null;
      sectionDragRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director, chars, canvasLinks, canvasRefs, characterIds, state.canvasSections, state.canvasEdges, allKeys.join(",")]);

  // 无限画布滚轮：默认平移；Ctrl/⌘+滚轮（含触控板捏合）围绕光标缩放；Shift+滚轮横向平移
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const z = zoomRef.current;
      const p = panStateRef.current;
      if (e.ctrlKey || e.metaKey) {
        const r = el!.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * (1 - e.deltaY * 0.0015)));
        setPan({ x: mx - ((mx - p.x) / z) * nz, y: my - ((my - p.y) / z) * nz });
        setZoom(nz);
      } else {
        const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
        setPan({ x: p.x - dx, y: p.y - dy });
      }
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
    if (key.startsWith("shot-")) {
      const idx = Number(key.slice(5));
      if (Number.isFinite(idx)) patch({ activeShotIdx: idx });
    }
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
  function startLink(e: React.MouseEvent, fromKey: string) {
    e.stopPropagation();
    setMenu(null);
    modeRef.current = "link";
    linkRef.current = { fromKey };
    setLinking(true);
    const from = handleScreen(fromKey);
    setTempLink({ from, to: from });
  }
  function startSectionDrag(e: React.MouseEvent, id: string, x: number, y: number) {
    e.stopPropagation();
    setMenu(null);
    modeRef.current = "section";
    sectionDragRef.current = { id, sm: { x: e.clientX, y: e.clientY }, sp: { x, y } };
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
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(r.width / cw, r.height / ch)));
    setZoom(nz);
    setPan({ x: r.width / 2 - (minX + (maxX - minX) / 2) * nz, y: r.height / 2 - (minY + (maxY - minY) / 2) * nz });
  }

  // 围绕视口中心缩放（缩放按钮用）
  function zoomAtCenter(factor: number) {
    const el = viewportRef.current;
    const z = zoomRef.current;
    const p = panStateRef.current;
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor));
    if (!el) {
      setZoom(nz);
      return;
    }
    const r = el.getBoundingClientRect();
    const cx = r.width / 2;
    const cy = r.height / 2;
    setPan({ x: cx - ((cx - p.x) / z) * nz, y: cy - ((cy - p.y) / z) * nz });
    setZoom(nz);
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

  useEffect(() => {
    if (!hasContent || didAutoFitRef.current) return;
    didAutoFitRef.current = true;
    const id = requestAnimationFrame(() => fitToContent());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasContent, shots.length, importedChars.length]);

  const marqueeBox = marquee
    ? { x: Math.min(marquee.x0, marquee.x1), y: Math.min(marquee.y0, marquee.y1), w: Math.abs(marquee.x1 - marquee.x0), h: Math.abs(marquee.y1 - marquee.y0) }
    : null;

  const immersiveInset = immersive && reserveBottomChrome;

  return (
    <div className={`relative h-full w-full overflow-hidden bg-[var(--bg-inset)] ${immersiveInset ? "pb-14" : ""}`}>
      {/* 缩放控制 */}
      <div className="absolute right-4 top-4 z-30 flex flex-col gap-1.5">
        <button type="button" onClick={() => zoomAtCenter(1.2)} className="btn-secondary rounded-lg p-2" title="放大"><FiZoomIn className="h-4 w-4" /></button>
        <button type="button" onClick={() => zoomAtCenter(1 / 1.2)} className="btn-secondary rounded-lg p-2" title="缩小"><FiZoomOut className="h-4 w-4" /></button>
        <button type="button" onClick={fitToContent} className="btn-secondary rounded-lg p-2" title="适应全部内容"><FiMaximize className="h-4 w-4" /></button>
        <span className="mt-1 text-center text-[10px] text-[var(--text-caption)]">{Math.round(zoom * 100)}%</span>
      </div>

      {!hasContent && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-[var(--text-secondary)]">无限画布是空的</p>
            <p className="mt-1 text-xs text-[var(--text-caption)]">先到「创作中心」运行编导，分镜与角色会自动铺到这里</p>
            <a href="/ai-video" className="btn-primary mt-3 inline-block rounded-lg px-4 py-2 text-sm">去创作中心</a>
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
        <div
          className="absolute origin-top-left"
          style={
            zoom === 1
              ? { left: Math.round(pan.x), top: Math.round(pan.y) }
              : { left: 0, top: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }
          }
          data-bg
        >
          {/* 分区（视觉编组，置于卡片之下） */}
          {state.canvasSections.map((s) => {
            const live = sectionLive?.id === s.id ? sectionLive : null;
            const x = live ? live.x : s.x;
            const y = live ? live.y : s.y;
            return (
              <div
                key={s.id}
                className="absolute rounded-xl border-2 border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/5"
                style={{ left: x, top: y, width: s.w, height: s.h }}
              >
                <div
                  onMouseDown={(e) => startSectionDrag(e, s.id, s.x, s.y)}
                  className="flex cursor-grab items-center justify-between gap-2 rounded-t-lg bg-[var(--accent)]/15 px-3 py-1.5 active:cursor-grabbing"
                >
                  <input
                    value={s.title}
                    onChange={(e) => updateSection(s.id, { title: e.target.value })}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full bg-transparent text-sm font-semibold text-[var(--accent)] outline-none"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => removeSection(s.id)}
                    className="shrink-0 text-[var(--text-caption)] hover:text-[var(--danger)]"
                    title="删除分区"
                  >
                    <FiTrash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* 角色卡 */}
          {importedChars.map((c) => {
            const key = `char-${c.id}`;
            const p = posOf(key);
            const sel = selected.has(key);
            return (
              <div
                key={c.id}
                data-card-key={key}
                onMouseDown={(e) => onCardDown(e, key)}
                className={`group absolute cursor-grab rounded-xl border bg-[var(--bg-surface)] shadow-lg active:cursor-grabbing ${sel ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)]"}`}
                style={{ left: p.x, top: p.y, width: CHAR_W, height: CHAR_H }}
              >
                <div className="flex h-[210px] w-full items-center justify-center overflow-hidden rounded-t-xl bg-black/30">
                  {c.refImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.refImageUrl} alt={c.name} className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <FiUser className="h-9 w-9 text-[var(--text-secondary)]" />
                  )}
                </div>
                <div className="px-3 py-2">
                  <span className="font-mono text-base font-semibold text-[var(--accent)]">@{c.name}</span>
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text-primary)]">{c.appearance}</p>
                </div>
                <div
                  onMouseDown={(e) => startLink(e, key)}
                  title="拖到另一张卡连线（角色→分镜=选角）"
                  className={`absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-[var(--accent)] shadow transition-opacity ${linking ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}
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
            const playIdx = editSequence ? playOrderIndex(state, i) : i + 1;
            const clip = editSequence?.clips[key];
            const durationTag = clip ? `${clip.durationSec}s` : `${shot.duration}s`;
            const shotAspectCss = shotAspectCssForIndex(
              i,
              state.aspectRatio,
              state.customAspectRatio,
              state.shotImageMeta
            );
            const cardH = computeShotCardHeight(shotAspectCss);
            return (
              <Fragment key={i}>
              <div
                data-shot-idx={i}
                data-card-key={key}
                onMouseDown={(e) => onCardDown(e, key)}
                className={`group absolute cursor-grab rounded-xl border bg-[var(--bg-surface)] shadow-lg active:cursor-grabbing ${sel ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : linking ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                style={{ left: p.x, top: p.y, width: SHOT_W }}
              >
                <div
                  onMouseDown={(e) => startLink(e, key)}
                  title="拖到另一张卡连线（角色→分镜=选角）"
                  className={`absolute -right-2.5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-[var(--accent)] shadow transition-opacity ${linking ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}
                />
                <div className="flex items-center justify-between rounded-t-xl bg-[var(--bg-inset)] px-3 py-2">
                  <span className="text-base font-bold text-[var(--text-primary)]">
                    <span className="mr-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-white">
                      {playIdx}
                    </span>
                    镜头 {i + 1}
                  </span>
                  <span className="text-sm font-medium text-[var(--text-secondary)]">{durationTag}</span>
                </div>

                {/* 画面预览区：与项目画幅一致，完整显示不裁切 */}
                <div
                  className="relative w-full bg-black/30"
                  style={{ aspectRatio: shotAspectCss }}
                >
                  {frameImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={frameImg}
                      alt={`镜头${i + 1}`}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => openFramePreview(frameImg)}
                      className="h-full w-full cursor-zoom-in object-contain"
                      draggable={false}
                      title="点击查看大图"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-secondary)]">未生成画面</span>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => generateFrame(i)}
                        disabled={busy}
                        className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        {busy ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiImage className="h-3.5 w-3.5" />}
                        {busy ? "生成中…约1分钟" : "生成画面"}
                      </button>
                    </div>
                  )}
                  {busy && frameImg && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                      <FiLoader className="h-6 w-6 animate-spin" />
                    </span>
                  )}
                  {/* 画面操作（右下角，hover 显示） */}
                  <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {frameImg && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => generateFrame(i)}
                        disabled={busy}
                        title="重新生成画面"
                        className="rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white hover:bg-black/80"
                      >
                        重生成
                      </button>
                    )}
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => generateVariants(i)}
                      disabled={varying[i]}
                      title="生成 3 个变体候选"
                      className="inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white hover:bg-black/80"
                    >
                      {varying[i] ? <FiLoader className="h-3 w-3 animate-spin" /> : <FiPlus className="h-3 w-3" />}
                      变体
                    </button>
                  </div>
                </div>

                <p title={shot.providerPrompt} className="line-clamp-3 px-3 py-2 text-[15px] font-semibold leading-relaxed text-[var(--text-primary)]">
                  {zhSummary}
                </p>
                {frameErr[i] && <p className="px-3 pb-1 text-[11px] leading-tight text-[var(--danger)] line-clamp-2">{frameErr[i]}</p>}
              </div>
              {variants[i]?.length ? (
                <div
                  className="absolute flex gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--bg-surface)] p-1.5 shadow-xl"
                  style={{ left: p.x, top: p.y + cardH + 8, width: SHOT_W, zIndex: 5 }}
                >
                  {variants[i].map((f, vi) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={vi}
                      src={f.url}
                      alt={`变体${vi + 1}`}
                      title="点击采用此变体"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        adoptFrame(i, f);
                        setVariants((v) => { const n = { ...v }; delete n[i]; return n; });
                      }}
                      className="h-16 w-auto max-w-[4.5rem] cursor-pointer rounded object-contain hover:ring-2 hover:ring-[var(--accent)]"
                      style={{ aspectRatio: shotAspectCss }}
                      draggable={false}
                    />
                  ))}
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setVariants((v) => { const n = { ...v }; delete n[i]; return n; })}
                    className="self-start text-[var(--text-caption)] hover:text-[var(--danger)]"
                    title="关闭变体"
                  >
                    <FiTrash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
              </Fragment>
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
                data-card-key={key}
                onMouseDown={(e) => onCardDown(e, key)}
                className={`group absolute cursor-grab rounded-lg border bg-[var(--bg-surface)] shadow-lg active:cursor-grabbing ${sel ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)]"}`}
                style={{ left: p.x, top: p.y, width: REF_W, height: REF_H }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.url} alt="参考图" className="h-full w-full rounded-lg object-cover" draggable={false} />
                <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white">参考</span>
                <div
                  onMouseDown={(e) => startLink(e, key)}
                  title="拖到另一张卡连线"
                  className={`absolute -right-2.5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-[var(--accent)] shadow transition-opacity ${linking ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}
                />
              </div>
            );
          })}
        </div>

        {/* 连线层（屏幕坐标） */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {canvasLinks.map((l, idx) => {
            if (!chars.some((c) => c.id === l.charId) || l.shotIdx >= shots.length) return null;
            const a = charConnectorScreen(l.charId);
            const b = centerScreen(`shot-${l.shotIdx}`, SHOT_W, sizeOf(`shot-${l.shotIdx}`).h);
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
          {state.canvasEdges.map((edge) => {
            if (!keyExists(edge.from) || !keyExists(edge.to)) return null;
            const a = cardCenterScreen(edge.from);
            const b = cardCenterScreen(edge.to);
            return (
              <g key={edge.id}>
                <path d={`M ${a.x} ${a.y} C ${a.x + 50} ${a.y}, ${b.x - 50} ${b.y}, ${b.x} ${b.y}`} fill="none" stroke="var(--text-caption)" strokeWidth={1.8} opacity={0.55} />
                <path className="pointer-events-auto cursor-pointer" d={`M ${a.x} ${a.y} C ${a.x + 50} ${a.y}, ${b.x - 50} ${b.y}, ${b.x} ${b.y}`} fill="none" stroke="transparent" strokeWidth={12} onDoubleClick={() => removeEdge(edge.id)}>
                  <title>双击移除连线</title>
                </path>
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
            <button type="button" onClick={() => { addSection((menu.x - pan.x) / zoom, (menu.y - pan.y) / zoom); setMenu(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-inset)]"><FiPlus className="h-3.5 w-3.5" />添加分区</button>
            <button type="button" onClick={() => { fitToContent(); setMenu(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-inset)]"><FiMaximize className="h-3.5 w-3.5" />适应全部内容</button>
            {selected.size > 0 && (
              <button type="button" onClick={() => { deleteSelected(); setMenu(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--danger)] hover:bg-[var(--bg-inset)]"><FiTrash2 className="h-3.5 w-3.5" />删除选中（{selected.size}）</button>
            )}
          </div>
        </>
      )}
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => addReference(e.target.files?.[0])} />

      {galleryIndex !== null && frameGalleryItems.length > 0 && (
        <ImageGalleryLightbox
          items={frameGalleryItems}
          index={galleryIndex}
          onClose={() => setGalleryIndex(null)}
          onIndexChange={setGalleryIndex}
        />
      )}

      {/* 小地图 */}
      {hasContent && bounds && vpRect && (
        <div
          className={`absolute right-4 z-20 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]/90 shadow ${immersiveInset ? "bottom-16" : "bottom-3"}`}
          style={{ width: MM_W, height: MM_H }}
          onClick={onMinimapClick}
        >
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
        <div className={`absolute left-1/2 z-20 max-w-[92%] -translate-x-1/2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-5 py-2 text-center text-sm font-medium text-[var(--text-secondary)] shadow-lg ${immersiveInset ? "bottom-16" : "bottom-4"}`}>
          滚轮/触控板平移 · Ctrl/⌘+滚轮缩放 · 拖空白平移 · 拖卡片右侧圆点连线（角色→分镜=选角）· 双击连线删除 · Shift/⌘框选 · Delete 删除
        </div>
      )}
    </div>
  );
}
