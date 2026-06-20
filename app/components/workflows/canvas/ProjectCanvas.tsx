"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiUser, FiZoomIn, FiZoomOut, FiMaximize } from "react-icons/fi";
import { useT2VWorkbenchStore } from "@/app/lib/workbench-persist/t2v-store";

type Character = {
  id: string;
  name: string;
  appearance: string;
  refImageUrl: string | null;
  createdAt: string;
};

const SHOT_W = 220;
const SHOT_H = 160;
const CHAR_W = 170;
const CHAR_H = 220;
const GAP = 48;

type Mode = "pan" | "card" | "link" | null;

export default function ProjectCanvas() {
  const { state, patch } = useT2VWorkbenchStore();
  const { director, characterIds, canvasPositions, canvasLinks } = state;

  const [chars, setChars] = useState<Character[]>([]);
  const [pan, setPan] = useState({ x: 40, y: 24 });
  const [zoom, setZoom] = useState(1);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    canvasPositions
  );
  const [linking, setLinking] = useState(false);
  const [tempLink, setTempLink] = useState<{
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<Mode>(null);
  const dragCardRef = useRef<{ key: string; sm: { x: number; y: number }; sp: { x: number; y: number } } | null>(null);
  const panRef = useRef<{ sm: { x: number; y: number }; sp: { x: number; y: number } } | null>(null);
  const linkRef = useRef<{ charId: string } | null>(null);
  const zoomRef = useRef(zoom);
  const panStateRef = useRef(pan);
  const positionsRef = useRef(positions);
  useEffect(() => {
    zoomRef.current = zoom;
    panStateRef.current = pan;
    positionsRef.current = positions;
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

  // 默认布局：角色一排在上，分镜一排在下
  const defaultPos = useCallback((key: string): { x: number; y: number } => {
    if (key.startsWith("char-")) {
      const i = importedChars.findIndex((c) => `char-${c.id}` === key);
      return { x: 40 + Math.max(0, i) * (CHAR_W + GAP), y: 40 };
    }
    const i = Number(key.replace("shot-", "")) || 0;
    return { x: 40 + i * (SHOT_W + GAP), y: 40 + CHAR_H + 90 };
  }, [importedChars]);

  const posOf = useCallback(
    (key: string) => positions[key] ?? defaultPos(key),
    [positions, defaultPos]
  );

  // 卡片中心 → 屏幕坐标（用于画连线）
  const centerScreen = (key: string, w: number, h: number) => {
    const p = posOf(key);
    return { x: pan.x + (p.x + w / 2) * zoom, y: pan.y + (p.y + h / 2) * zoom };
  };
  const charConnectorScreen = (id: string) => {
    const p = posOf(`char-${id}`);
    return { x: pan.x + (p.x + CHAR_W) * zoom, y: pan.y + (p.y + CHAR_H / 2) * zoom };
  };

  // 选角：连线 = 给该分镜注入 @角色名
  function castCharacter(charId: string, shotIdx: number) {
    if (!director) return;
    if (canvasLinks.some((l) => l.charId === charId && l.shotIdx === shotIdx)) return;
    const ch = chars.find((c) => c.id === charId);
    if (!ch) return;
    const cur = (director.prompts[shotIdx]?.providerPrompt ?? "").trim();
    const token = `@${ch.name}`;
    const next = cur.includes(token)
      ? cur
      : cur
        ? `${cur.replace(/\.\s*$/, "")}, ${token}.`
        : token;
    patch({
      director: {
        ...director,
        prompts: director.prompts.map((p, i) =>
          i === shotIdx ? { ...p, providerPrompt: next } : p
        ),
      },
      canvasLinks: [...canvasLinks, { charId, shotIdx }],
    });
  }

  function removeLink(charId: string, shotIdx: number) {
    patch({
      canvasLinks: canvasLinks.filter(
        (l) => !(l.charId === charId && l.shotIdx === shotIdx)
      ),
    });
  }

  // 全局拖拽/连线监听
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const mode = modeRef.current;
      if (mode === "pan" && panRef.current) {
        const { sm, sp } = panRef.current;
        setPan({ x: sp.x + (e.clientX - sm.x), y: sp.y + (e.clientY - sm.y) });
      } else if (mode === "card" && dragCardRef.current) {
        const { key, sm, sp } = dragCardRef.current;
        const z = zoomRef.current;
        setPositions((prev) => ({
          ...prev,
          [key]: { x: sp.x + (e.clientX - sm.x) / z, y: sp.y + (e.clientY - sm.y) / z },
        }));
      } else if (mode === "link") {
        const r = viewportRef.current?.getBoundingClientRect();
        if (r) {
          setTempLink((t) =>
            t ? { ...t, to: { x: e.clientX - r.left, y: e.clientY - r.top } } : t
          );
        }
      }
    }
    function onUp(e: MouseEvent) {
      const mode = modeRef.current;
      if (mode === "card") {
        patch({ canvasPositions: positionsRef.current });
      } else if (mode === "link" && linkRef.current) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const shotEl = el?.closest("[data-shot-idx]") as HTMLElement | null;
        if (shotEl?.dataset.shotIdx != null) {
          castCharacter(linkRef.current.charId, Number(shotEl.dataset.shotIdx));
        }
        setLinking(false);
        setTempLink(null);
      }
      modeRef.current = null;
      dragCardRef.current = null;
      panRef.current = null;
      linkRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director, chars, canvasLinks]);

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
      const nz = Math.min(2, Math.max(0.3, z * (1 - e.deltaY * 0.0015)));
      const cx = (mx - p.x) / z;
      const cy = (my - p.y) / z;
      setPan({ x: mx - cx * nz, y: my - cy * nz });
      setZoom(nz);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function startCardDrag(e: React.MouseEvent, key: string) {
    e.stopPropagation();
    modeRef.current = "card";
    dragCardRef.current = {
      key,
      sm: { x: e.clientX, y: e.clientY },
      sp: posOf(key),
    };
  }
  function startLink(e: React.MouseEvent, charId: string) {
    e.stopPropagation();
    modeRef.current = "link";
    linkRef.current = { charId };
    setLinking(true);
    const from = charConnectorScreen(charId);
    setTempLink({ from, to: from });
  }
  function startPan(e: React.MouseEvent) {
    modeRef.current = "pan";
    panRef.current = { sm: { x: e.clientX, y: e.clientY }, sp: pan };
  }

  function fit() {
    setZoom(1);
    setPan({ x: 40, y: 24 });
  }

  const hasContent = shots.length > 0 || importedChars.length > 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--bg-inset)]">
      {/* 缩放控制 */}
      <div className="absolute right-4 top-4 z-20 flex flex-col gap-1.5">
        <button type="button" onClick={() => setZoom((z) => Math.min(2, z + 0.15))} className="btn-secondary rounded-lg p-2" title="放大">
          <FiZoomIn className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))} className="btn-secondary rounded-lg p-2" title="缩小">
          <FiZoomOut className="h-4 w-4" />
        </button>
        <button type="button" onClick={fit} className="btn-secondary rounded-lg p-2" title="复位">
          <FiMaximize className="h-4 w-4" />
        </button>
        <span className="mt-1 text-center text-[10px] text-[var(--text-caption)]">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {!hasContent && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-[var(--text-secondary)]">画布是空的</p>
            <p className="mt-1 text-xs text-[var(--text-caption)]">
              先到「视频创作」运行编导，分镜与角色会自动铺到这里
            </p>
            <a href="/ai-video" className="btn-primary mt-3 inline-block rounded-lg px-4 py-2 text-sm">
              去视频创作
            </a>
          </div>
        </div>
      )}

      {/* 视口 */}
      <div
        ref={viewportRef}
        onMouseDown={startPan}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* 变换层：卡片 */}
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {/* 角色卡 */}
          {importedChars.map((c) => {
            const p = posOf(`char-${c.id}`);
            return (
              <div
                key={c.id}
                onMouseDown={(e) => startCardDrag(e, `char-${c.id}`)}
                className="absolute cursor-grab overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg active:cursor-grabbing"
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
                {/* 连线手柄 */}
                <div
                  onMouseDown={(e) => startLink(e, c.id)}
                  title="拖到分镜 = 选角（注入 @角色名）"
                  className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-[var(--accent)] shadow"
                />
              </div>
            );
          })}

          {/* 分镜卡 */}
          {shots.map((shot, i) => {
            const p = posOf(`shot-${i}`);
            const frame = state.batchResults?.[i];
            return (
              <div
                key={i}
                data-shot-idx={i}
                onMouseDown={(e) => startCardDrag(e, `shot-${i}`)}
                className={`absolute cursor-grab overflow-hidden rounded-xl border bg-[var(--bg-surface)] shadow-lg active:cursor-grabbing ${
                  linking ? "border-[var(--accent)]" : "border-[var(--border)]"
                }`}
                style={{ left: p.x, top: p.y, width: SHOT_W, height: SHOT_H }}
              >
                <div className="flex items-center justify-between bg-[var(--bg-inset)] px-2.5 py-1">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">镜头 {i + 1}</span>
                  <span className="text-[10px] text-[var(--text-caption)]">{shot.duration}s</span>
                </div>
                {frame?.status === "success" && frame.videoUrl ? (
                  <video src={frame.videoUrl} className="h-[78px] w-full object-cover" muted playsInline />
                ) : null}
                <p className="line-clamp-4 px-2.5 py-1.5 text-[10px] leading-snug text-[var(--text-secondary)]">
                  {shot.providerPrompt}
                </p>
              </div>
            );
          })}
        </div>

        {/* 连线层（屏幕坐标） */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {canvasLinks.map((l, idx) => {
            const a = charConnectorScreen(l.charId);
            const b = centerScreen(`shot-${l.shotIdx}`, SHOT_W, SHOT_H);
            if (!chars.some((c) => c.id === l.charId) || l.shotIdx >= shots.length) return null;
            return (
              <g key={idx}>
                <path
                  d={`M ${a.x} ${a.y} C ${a.x + 60} ${a.y}, ${b.x - 60} ${b.y}, ${b.x} ${b.y}`}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  opacity={0.8}
                />
                <circle
                  className="pointer-events-auto cursor-pointer"
                  cx={(a.x + b.x) / 2}
                  cy={(a.y + b.y) / 2}
                  r={7}
                  fill="var(--bg-surface)"
                  stroke="var(--accent)"
                  onClick={() => removeLink(l.charId, l.shotIdx)}
                >
                  <title>点击移除选角连线</title>
                </circle>
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 + 3}
                  textAnchor="middle"
                  className="pointer-events-none"
                  fontSize={9}
                  fill="var(--accent)"
                >
                  ×
                </text>
              </g>
            );
          })}
          {tempLink && (
            <path
              d={`M ${tempLink.from.x} ${tempLink.from.y} C ${tempLink.from.x + 60} ${tempLink.from.y}, ${tempLink.to.x - 60} ${tempLink.to.y}, ${tempLink.to.x} ${tempLink.to.y}`}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeDasharray="5 4"
            />
          )}
        </svg>
      </div>

      {/* 底部提示 */}
      {hasContent && (
        <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[var(--bg-surface)]/90 px-4 py-1.5 text-[11px] text-[var(--text-caption)] shadow">
          拖空白处平移 · 滚轮缩放 · 拖角色右侧圆点连到分镜 = 选角
        </div>
      )}
    </div>
  );
}
