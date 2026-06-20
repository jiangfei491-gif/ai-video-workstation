"use client";

import { useRef, useState } from "react";
import { FiZap, FiCheck, FiRotateCcw, FiImage } from "react-icons/fi";
import { fileToScaledDataUrl } from "@/app/lib/image-client";

type Point = { x: number; y: number }; // 归一化 0..1
type MoveType =
  | "pan"
  | "push"
  | "pull"
  | "orbit"
  | "tracking"
  | "handheld"
  | "static";
type Speed = "slow" | "normal" | "fast";

type Props = {
  /** 把运镜指令应用到当前镜头（追加到提示词） */
  onApply: (directive: string) => void;
};

const MOVE_TYPES: { value: MoveType; label: string; needsPath: boolean }[] = [
  { value: "pan", label: "平移/摇镜", needsPath: true },
  { value: "push", label: "推近", needsPath: false },
  { value: "pull", label: "拉远", needsPath: false },
  { value: "orbit", label: "环绕", needsPath: true },
  { value: "tracking", label: "跟随主体", needsPath: false },
  { value: "handheld", label: "手持", needsPath: false },
  { value: "static", label: "固定", needsPath: false },
];

const SPEEDS: { value: Speed; label: string }[] = [
  { value: "slow", label: "缓慢" },
  { value: "normal", label: "中速" },
  { value: "fast", label: "快速" },
];

function speedWord(s: Speed): string {
  return s === "slow" ? "slowly " : s === "fast" ? "quickly " : "";
}

/** 由绘制路径的净位移 + 运镜类型 + 速度，拼出英文运镜指令 */
function buildDirective(
  type: MoveType,
  points: Point[],
  speed: Speed
): string {
  const sw = speedWord(speed);
  const first = points[0];
  const last = points[points.length - 1];
  const dx = first && last ? last.x - first.x : 0;
  const dy = first && last ? last.y - first.y : 0;

  switch (type) {
    case "push":
      return `camera ${sw}pushes in`;
    case "pull":
      return `camera ${sw}pulls back`;
    case "tracking":
      return `camera ${sw}tracks the subject`;
    case "handheld":
      return `handheld camera with subtle natural shake`;
    case "static":
      return `static locked-off camera`;
    case "orbit":
      return `camera ${sw}orbits around the subject ${
        dx >= 0 ? "clockwise" : "counter-clockwise"
      }`;
    case "pan":
    default: {
      if (points.length < 2) return `camera ${sw}pans right`;
      const parts: string[] = [];
      if (Math.abs(dx) > 0.08) parts.push(dx > 0 ? "pans right" : "pans left");
      if (Math.abs(dy) > 0.08) parts.push(dy > 0 ? "tilts down" : "tilts up");
      if (parts.length === 0) parts.push("pans right");
      return `camera ${sw}${parts.join(" and ")}`;
    }
  }
}

export default function CameraTrajectoryPanel({ onApply }: Props) {
  const [points, setPoints] = useState<Point[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [type, setType] = useState<MoveType>("pan");
  const [speed, setSpeed] = useState<Speed>("slow");
  const [bg, setBg] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const needsPath = MOVE_TYPES.find((m) => m.value === type)?.needsPath ?? false;
  const directive = buildDirective(type, points, speed);

  function toPoint(e: React.MouseEvent): Point | null {
    const el = boxRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }

  function onDown(e: React.MouseEvent) {
    const p = toPoint(e);
    if (!p) return;
    setDrawing(true);
    setPoints([p]);
  }
  function onMove(e: React.MouseEvent) {
    if (!drawing) return;
    const p = toPoint(e);
    if (p) setPoints((prev) => [...prev, p]);
  }
  function onUp() {
    setDrawing(false);
  }

  async function handleBg(file: File | undefined | null) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      setBg(await fileToScaledDataUrl(file));
    } catch {
      /* ignore */
    }
  }

  function apply() {
    onApply(directive);
    setApplied(true);
    setTimeout(() => setApplied(false), 1500);
  }

  const pathStr =
    points.length > 1
      ? points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")
      : "";
  const head = points[points.length - 1];
  const prev = points[points.length - 2];

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]/40 p-4">
      <p className="mb-3 text-xs text-[var(--text-caption)]">
        在画面上拖动画出**运镜方向**，选运镜类型与速度，自动生成英文运镜指令并追加到镜头提示词。
      </p>

      <div className="flex flex-wrap gap-4">
        {/* 画布 */}
        <div className="shrink-0">
          <div
            ref={boxRef}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
            className="relative h-[320px] w-[180px] cursor-crosshair select-none overflow-hidden rounded-lg border border-[var(--border)] bg-black/30"
            style={
              bg
                ? {
                    backgroundImage: `url(${bg})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            {/* 网格 */}
            {!bg && (
              <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
                  backgroundSize: "33.33% 33.33%",
                }}
              />
            )}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              {pathStr && (
                <polyline
                  points={pathStr}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {head && prev && (
                <circle cx={head.x * 100} cy={head.y * 100} r="2.2" fill="var(--accent)" />
              )}
              {points[0] && (
                <circle
                  cx={points[0].x * 100}
                  cy={points[0].y * 100}
                  r="1.8"
                  fill="white"
                  stroke="var(--accent)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            {points.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] text-[var(--text-caption)]">
                在此拖动画出运镜方向
              </div>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="btn-secondary inline-flex items-center gap-1 rounded px-2 py-1 text-[11px]"
            >
              <FiImage className="h-3 w-3" />
              参考帧
            </button>
            <button
              type="button"
              onClick={() => setPoints([])}
              className="btn-secondary inline-flex items-center gap-1 rounded px-2 py-1 text-[11px]"
            >
              <FiRotateCcw className="h-3 w-3" />
              重画
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleBg(e.target.files?.[0])}
            />
          </div>
        </div>

        {/* 控制 */}
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <label className="workbench-label mb-1.5 block text-xs">运镜类型</label>
            <div className="flex flex-wrap gap-1.5">
              {MOVE_TYPES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setType(m.value)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    type === m.value ? "nav-item-active" : "btn-secondary"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {needsPath && points.length < 2 && (
              <p className="mt-1 text-[11px] text-[var(--text-caption)]">
                该类型建议在左侧画出方向
              </p>
            )}
          </div>

          <div>
            <label className="workbench-label mb-1.5 block text-xs">速度</label>
            <div className="flex gap-1.5">
              {SPEEDS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSpeed(s.value)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    speed === s.value ? "nav-item-active" : "btn-secondary"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-[var(--bg-surface)] p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs text-[var(--text-caption)]">
              <FiZap className="h-3.5 w-3.5" />
              运镜指令（追加到提示词）
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{directive}.</p>
          </div>

          <button
            type="button"
            onClick={apply}
            className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
          >
            {applied ? <FiCheck className="h-4 w-4" /> : <FiZap className="h-4 w-4" />}
            {applied ? "已追加到镜头" : "追加到当前镜头"}
          </button>
        </div>
      </div>
    </div>
  );
}
