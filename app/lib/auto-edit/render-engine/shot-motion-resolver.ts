/**
 * Shot Motion Resolver（Phase 1 · ACTIVE 链承接 Narrative Shot）
 *
 * 职责：把 Narrative Shot 的镜头语言字段（camera / visualFocus / shotPurpose）
 * 解析为结构化 motionSpec，供 buildImageSegmentCommand 翻译成 FFmpeg zoompan 参数。
 *
 * 边界：
 * - 这里只做「语义 → 结构化运动参数」的解析（业务规则集中在此）。
 * - FFmpeg 参数翻译在 clip-commands.ts，不在这里。
 * - 缺少全部富字段时返回 null → 上游回退旧固定 zoompan（向后兼容）。
 * - reaction 本 Phase 仅透传，不参与运动解析。
 */

export type FocusAnchor =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/** 结构化镜头运动规格（与 FFmpeg 无关，纯数据） */
export type ShotMotionSpec = {
  /** 景别对应的等效内缩比例（1 = 不内缩），供审计 */
  scale: number;
  /** 裁切窗口占源比例（由景别推导），供审计 */
  crop: { widthRatio: number; heightRatio: number };
  /** 焦点锚点标签 */
  focusAnchor: FocusAnchor;
  /** 归一化焦点 0..1（zoompan 窗口中心） */
  focusX: number;
  focusY: number;
  /** 起始 / 结束缩放（均 ≥ 1.0） */
  zoomStart: number;
  zoomEnd: number;
  /** 归一化位移量 -1..1（运动全程的漂移方向与幅度） */
  panX: number;
  panY: number;
  /** 运动速度倍率（1 = 基准） */
  motionSpeed: number;
  /** 解析来源，供 fixture / 日志审计 */
  source: {
    camera?: string;
    visualFocus?: string;
    shotPurpose?: string;
  };
};

export type ShotMotionInput = {
  camera?: string | null;
  visualFocus?: string | null;
  shotPurpose?: string | null;
};

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

const round4 = (v: number): number => Number(v.toFixed(4));

/** 确定性字符串散列 → [0,1)，用于让不同 visualFocus 文案得到可区分的锚点 */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const has = (text: string, keys: string[]): boolean =>
  keys.some((k) => text.includes(k));

function anchorLabel(fx: number, fy: number): FocusAnchor {
  const h = fx < 0.42 ? "left" : fx > 0.58 ? "right" : "center-x";
  const v = fy < 0.42 ? "top" : fy > 0.58 ? "bottom" : "center-y";
  if (h === "center-x" && v === "center-y") return "center";
  if (h === "center-x") return v as FocusAnchor;
  if (v === "center-y") return h as FocusAnchor;
  return `${v}-${h}` as FocusAnchor;
}

/**
 * 解析镜头运动。全部富字段缺失时返回 null（触发上游旧 zoompan fallback）。
 */
export function resolveShotMotion(input: ShotMotionInput): ShotMotionSpec | null {
  const camera = (input.camera ?? "").trim();
  const visualFocus = (input.visualFocus ?? "").trim();
  const shotPurpose = (input.shotPurpose ?? "").trim();

  // 无任何镜头语言 → 交给旧固定 zoompan
  if (!camera && !visualFocus && !shotPurpose) return null;

  const cam = camera.toLowerCase();
  const purpose = shotPurpose.toLowerCase();
  const focusT = visualFocus.toLowerCase();

  // 1) 景别 → baseline 缩放
  const closeUp = has(cam, ["特写", "近景", "面部", "close", "cu", "ecu"]);
  const wide = has(cam, ["全景", "远景", "大景", "wide", "establish", "long shot"]);
  let baseZoom = closeUp ? 1.18 : wide ? 1.0 : 1.06;

  // 2) shotPurpose → 运动风格（速度 / 幅度 / 景别微调）
  let speed = 1.0;
  let amplitude = 0.08;
  if (has(purpose, ["定场", "建立", "establish", "环境", "交代"])) {
    baseZoom = Math.min(baseZoom, 1.02);
    amplitude = 0.05;
    speed = 0.7;
  } else if (has(purpose, ["反应", "表情", "情绪", "reaction"])) {
    baseZoom = Math.max(baseZoom, 1.12);
    amplitude = 0.04;
    speed = 0.6;
  } else if (has(purpose, ["细节", "证据", "道具", "detail", "insert"])) {
    baseZoom = Math.max(baseZoom, 1.14);
    amplitude = 0.12;
    speed = 1.1;
  } else if (has(purpose, ["揭示", "发现", "展示", "reveal"])) {
    amplitude = 0.12;
    speed = 1.0;
  } else if (has(purpose, ["动作", "action", "移动"])) {
    amplitude = 0.1;
    speed = 1.4;
  } else if (has(purpose, ["过渡", "transition"])) {
    amplitude = 0.06;
    speed = 1.5;
  }

  // 3) camera 运镜质感
  if (has(cam, ["手持", "晃", "handheld", "shaky"])) speed *= 1.6;
  if (has(cam, ["固定", "静止", "定格", "static", "locked"])) {
    speed *= 0.3;
    amplitude = Math.min(amplitude, 0.03);
  }
  amplitude = clamp(amplitude * speed, 0.02, 0.22);

  // 方向：推近 / 拉远 / 默认轻推
  const pullOut = has(cam, ["拉", "后拉", "拉远", "pull out", "zoom out", "dolly out", "远离"]);
  const pushIn = has(cam, ["推", "靠近", "push in", "zoom in", "dolly in"]);
  let zoomStart: number;
  let zoomEnd: number;
  if (pullOut) {
    zoomStart = baseZoom + amplitude;
    zoomEnd = baseZoom;
  } else if (pushIn) {
    zoomStart = baseZoom;
    zoomEnd = baseZoom + amplitude;
  } else {
    zoomStart = baseZoom;
    zoomEnd = baseZoom + amplitude * 0.6;
  }
  zoomStart = clamp(zoomStart, 1.0, 1.5);
  zoomEnd = clamp(zoomEnd, 1.0, 1.5);

  // 4) visualFocus → 焦点锚点
  let fx = 0.5;
  let fy = 0.5;
  if (visualFocus) {
    if (has(focusT, ["左", "left"])) fx = 0.32;
    if (has(focusT, ["右", "right"])) fx = 0.68;
    if (has(focusT, ["上", "top", "顶", "天"])) fy = 0.32;
    if (has(focusT, ["下", "bottom", "底", "地"])) fy = 0.68;
    if (has(focusT, ["手", "hand"])) fy = Math.max(fy, 0.66);
    if (has(focusT, ["脸", "眼", "眉", "面", "表情", "face", "eye"])) fy = Math.min(fy, 0.4);
    if (has(focusT, ["角"])) {
      if (fx === 0.5) fx = 0.7;
      if (fy === 0.5) fy = 0.7;
    }
    // 去同：让不同 focus 文案得到确定性、可区分的微偏移
    fx = clamp(fx + (hash01(visualFocus) - 0.5) * 0.18, 0.15, 0.85);
    fy = clamp(fy + (hash01(`${visualFocus}::y`) - 0.5) * 0.18, 0.15, 0.85);
  }

  // 5) 位移漂移（横摇 / 竖摇）
  let panX = 0;
  let panY = 0;
  const panAmt = clamp(0.28 * speed, 0.08, 0.4);
  if (has(cam, ["左移", "向左", "左摇", "pan left"])) panX = -panAmt;
  else if (has(cam, ["右移", "向右", "右摇", "pan right"])) panX = panAmt;
  if (has(cam, ["上摇", "抬", "tilt up"])) panY = -panAmt;
  else if (has(cam, ["下摇", "俯", "tilt down"])) panY = panAmt;

  return {
    scale: round4(baseZoom),
    crop: {
      widthRatio: round4(1 / baseZoom),
      heightRatio: round4(1 / baseZoom),
    },
    focusAnchor: anchorLabel(fx, fy),
    focusX: round4(fx),
    focusY: round4(fy),
    zoomStart: round4(zoomStart),
    zoomEnd: round4(zoomEnd),
    panX: round4(panX),
    panY: round4(panY),
    motionSpeed: round4(speed),
    source: {
      camera: camera || undefined,
      visualFocus: visualFocus || undefined,
      shotPurpose: shotPurpose || undefined,
    },
  };
}
