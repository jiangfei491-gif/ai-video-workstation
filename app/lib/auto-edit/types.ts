/** 成片节奏预设 */
export type PacingProfile = "documentary" | "viral" | "cinematic";

export type TransitionType =
  | "cut"
  | "crossfade"
  | "dip_black"
  | "slide_left"
  | "slide_right"
  | "slide_up"
  | "slide_down"
  | "zoom_in"
  | "blur"
  | "flash"
  | "wipe_left"
  | "wipe_right"
  | "push_left"
  | "push_right";

export type ClipSourceKind = "video" | "image" | "missing";

/** 单镜 clip 规格（Edit Graph 节点） */
export type ClipSpec = {
  key: string;
  shotIndex: number;
  label: string;
  sourceKind: ClipSourceKind;
  /** 本地可读路径或 /api/files/... */
  mediaUrl?: string;
  durationSec: number;
  sectionId?: string;
  qcScore?: number;
  hasCast?: boolean;
  storyboardHint?: string;
  // ── Narrative Shot 承接（Phase 1）：稳定身份 + 镜头语言透传 ──
  /** 叙事镜头稳定 id（长期映射用，禁止只依赖 shotIndex） */
  shotId?: string;
  /** 所属 Narrative Beat */
  beatId?: string;
  /** 关联 ImageTask（一图多镜复用溯源） */
  imageTaskId?: string;
  /** 运镜 / 景别 */
  camera?: string;
  /** 视觉焦点 */
  visualFocus?: string;
  /** 镜头目的（定场 / 反应 / 细节 …） */
  shotPurpose?: string;
  /** 人物反应（本 Phase 仅透传，不参与运动解析） */
  reaction?: string;
};

export type EditTransition = {
  fromKey: string;
  toKey: string;
  type: TransitionType;
  durationMs: number;
};

/** Edit Graph — 播放顺序与 clip 元数据的单一真相源 */
export type EditSequence = {
  playOrder: string[];
  clips: Record<string, ClipSpec>;
  transitions: EditTransition[];
  pacingProfile: PacingProfile;
  totalDurationSec: number;
  updatedAt: string;
};

/** AI 剪辑导演输出（在 EditSequence 上附加说明） */
export type EditPlan = EditSequence & {
  aiNotes: string[];
  sectionPacing: Record<string, string>;
  /** 每镜剪辑决策（AI Decision 面板） */
  clipRationale?: Record<
    string,
    { durationSec?: number; reason: string; tags?: string[] }
  >;
  transitionRationale?: Record<string, string>;
  model?: string;
  usage?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
};

export type EditRenderMode = "mixed" | "image" | "video";

export type EditRenderJobStatus = "idle" | "planning" | "rendering" | "success" | "failed";

export type EditRenderJob = {
  id: string;
  status: EditRenderJobStatus;
  progress: number;
  message: string;
  outputUrl?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
};

export type BuildEditInput = {
  topic: string;
  script?: string;
  storyboard: {
    shotIndex: number;
    duration: number;
    action: string;
    environment: string;
    camera: string;
    narration: string;
    // ── Narrative Shot 承接（Phase 1）──
    shotId?: string;
    beatId?: string;
    imageTaskId?: string;
    visualFocus?: string;
    shotPurpose?: string;
    reaction?: string;
  }[];
  sections: { id: string; title: string; x: number; y: number; w: number; h: number }[];
  shotPositions: Record<string, { x: number; y: number }>;
  narrativeEdges: { from: string; to: string }[];
  castLinks: { charId: string; shotIdx: number }[];
  shotFrames: Record<number, string>;
  batchResults: Record<
    number,
    { status: string; videoUrl: string | null; firstFrameUrl?: string | null }
  >;
  /** IMAGE 稳定身份取图：imageTaskId → 资产 url（档位 0 主链） */
  imageTaskFrames?: Record<string, string>;
  /** shotId → imageTaskId 映射（用于从 shotId 反查 imageTaskId） */
  shotToImageTaskMap?: Record<string, string>;
  fps: number;
  aspectRatio: string;
};
