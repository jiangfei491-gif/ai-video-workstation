import type { GenerationMode } from "@/app/lib/generation-mode";
import type { PipelineMode } from "@/app/lib/pipeline-mode";
import type { ProjectBible, ShotConsistencyMeta } from "@/app/lib/consistency-engine/types";
import { DEFAULT_PROJECT_BIBLE } from "@/app/lib/consistency-engine/types/bibles";
import type {
  CameraTemplateId,
  ConsistencySettings,
  ShotTimelineEntry,
  StylePresetId,
  WorldBible,
} from "@/app/lib/consistency-engine/types/world-style-camera";
import {
  DEFAULT_CONSISTENCY_SETTINGS,
  DEFAULT_WORLD_BIBLE,
} from "@/app/lib/consistency-engine/types/world-style-camera";
import type {
  AspectRatioPreset,
  ClarityId,
  SeedMode,
} from "@/app/lib/generation-params";
import type { ExportMeta } from "@/app/lib/export/types";
import type { ShotLockRecord } from "@/app/lib/shot-lock";
import type { WorkspaceMode } from "@/app/lib/workspace-mode";
import type { ProjectCostLedger } from "@/app/lib/cost-ledger/types";

export type VeoJobStatus = "idle" | "generating" | "success" | "failed";

export type VeoTestResult = {
  taskId: string;
  videoUrl: string | null;
  seed: number;
  firstFrameAssetId?: string;
  firstFrameUrl?: string;
};

/** 批量并行生成时，单个镜头的状态 */
export type BatchShotState = {
  status: "pending" | "generating" | "success" | "failed";
  videoUrl: string | null;
  taskId?: string;
  seed?: number;
  firstFrameAssetId?: string;
  firstFrameUrl?: string;
  error?: string;
};

export type StoryboardShot = {
  sceneNumber: number;
  duration: number;
  /** 叙事镜头 id（≠ imageTaskId） */
  shotId?: string;
  beatId?: string;
  character: string;
  action: string;
  reaction?: string;
  environment: string;
  camera: string;
  visualFocus?: string;
  shotPurpose?: string;
  transition?: string;
  narration: string;
  narrationRef?: string;
};

export type DirectorShot = {
  sceneNumber: number;
  providerPrompt: string;
  duration: number;
  /** 一致性：角色/场景/继承/变化量（系统组装 Prompt 用） */
  consistency?: ShotConsistencyMeta;
};

export { DEFAULT_PROJECT_BIBLE };
export type { ProjectBible, ShotConsistencyMeta };

export type DirectorState = {
  title: string;
  script: string;
  storyboard: StoryboardShot[];
  prompts: DirectorShot[];
};

export type VideoClarity = ClarityId;
export type VideoFps = 24 | 30 | 60;

export type CanvasShellTab = "canvas" | "edit";
/** 画布 / 剪辑 布局：融合为默认（同屏） */
export type CanvasShellLayout = "canvas" | "edit" | "fusion";
export type ScriptPanelView = "shot" | "full" | "ai";

/** 无限画布 / 剪辑中心 UI（切换页面后保留） */
export type CanvasUiState = {
  /** @deprecated 使用 shellLayout */
  shellTab: CanvasShellTab;
  shellLayout: CanvasShellLayout;
  scriptView: ScriptPanelView;
  rightTab: "ai" | "media" | "advanced";
  playheadSec: number;
  activeClipId: string | null;
  canvasPan: { x: number; y: number };
  canvasZoom: number;
  canvasSelectedKeys: string[];
  editScriptCollapsed: boolean;
  /** 融合视图：右侧剪辑面板展开 */
  editDockOpen: boolean;
  /** NLE 左侧资源中心标签 */
  editLibraryTab: "media" | "audio" | "subtitle" | "ai" | "script" | "storyboard";
  /** 融合视图：全屏分镜画布覆盖 */
  nleCanvasOverlay: boolean;
  /** 时间轴横向缩放 */
  editTimelineZoom: number;
};

export const DEFAULT_CANVAS_UI: CanvasUiState = {
  shellTab: "canvas",
  shellLayout: "fusion",
  scriptView: "full",
  rightTab: "ai",
  playheadSec: 0,
  activeClipId: null,
  canvasPan: { x: 40, y: 24 },
  canvasZoom: 1,
  canvasSelectedKeys: [],
  editScriptCollapsed: false,
  editDockOpen: true,
  editLibraryTab: "media",
  nleCanvasOverlay: false,
  editTimelineZoom: 1,
};

export type T2VWorkbenchState = {
  topic: string;
  /** 从内容中心带入的成稿脚本（编导分镜时优先使用） */
  sourceScript?: string;
  sourceScriptLabel?: string;
  /** 脚本目标成片时长（分钟），导入长脚本时用于对齐镜头规划 */
  targetDurationMinutes?: number;
  /** 图片预算（张）— 只控制生图成本，不控制叙事镜头数 */
  imageBudget: number;
  imageBudgetMode: import("@/app/lib/shot-control/image-budget").ImageBudgetMode;
  /** t2v 镜头数；t2i 编导临时参数，UI 不再暴露 */
  shotCount: number;
  /** t2v 单镜时长；t2i 内部 Ken Burns 占位，Phase 7 由配音驱动 */
  shotDurationSec: number;
  fps: VideoFps;
  aspectRatio: AspectRatioPreset | string;
  customAspectRatio?: string;
  clarity: VideoClarity;
  customClarityWidth?: number;
  customClarityHeight?: number;
  /** 创作管线：文生图→图生视频 vs 直接文生视频 */
  pipelineMode: PipelineMode;
  workspaceMode: WorkspaceMode;
  characterConsistency: boolean;
  sceneConsistency: boolean;
  seedMode: SeedMode;
  seed: number | null;
  mode: GenerationMode;
  director: DirectorState | null;
  /** 本项目导入的角色 id（来自资源中心，移除仅移出项目、不删仓库） */
  characterIds: string[];
  /** 本项目导入的场景 id（来自资源中心） */
  sceneIds: string[];
  /** 本项目导入的道具 id（来自资源中心） */
  propIds: string[];
  /** 项目画布：卡片位置（key 如 shot-0 / char-<id>） */
  canvasPositions: Record<string, { x: number; y: number }>;
  /** 项目画布：角色→分镜的选角连线 */
  canvasLinks: { charId: string; shotIdx: number }[];
  /** 项目画布：各分镜就地生成的首帧图 url（按镜头索引） */
  shotFrames: Record<number, string>;
  /** 各分镜首帧的图片资产 id（用于 i2v 参考） */
  shotFrameAssets: Record<number, string>;
  /** 生图任务列表（≠ storyboard 镜头列表） */
  imageTasks: import("@/app/lib/image-task/types").ImageTask[];
  /** Narrative Beat 分析结果（t2i） */
  narrativeBeats?: import("@/app/lib/narrative/types").NarrativeBeat[];
  /** Shot ↔ ImageTask 显式映射 */
  imageTaskMapping: import("@/app/lib/image-task/types").ImageTaskMapping;
  /** ImageTask 级成片 URL */
  imageTaskFrames: Record<string, string>;
  /** ImageTask 级资产 id */
  imageTaskFrameAssets: Record<string, string>;
  /** ImageTask 级 QC 时间轴（Score QC / Visual QC / Repair） */
  imageTaskTimeline: Record<string, ShotTimelineEntry>;
  /** 文生图模式：各镜头成片的生成模型信息 */
  shotImageMeta: Record<number, { model: string; source: string; aspectRatio?: string }>;
  /** 文生图模式：各镜头收藏标记 */
  shotFavorites: Record<number, boolean>;
  canvasRefs: { id: string; url: string }[];
  /** 项目画布：分区（视觉编组） */
  canvasSections: { id: string; title: string; x: number; y: number; w: number; h: number }[];
  /** 项目画布：任意卡片之间的关联连线（角色→分镜走 canvasLinks 选角，其余走这里） */
  canvasEdges: { id: string; from: string; to: string }[];
  /** 全片风格 DNA：注入所有首帧/视频生成，统一全片色调与风格 */
  projectStyle: string;
  /** 项目圣经：视频类型、色调、摄影语言、禁止项等全局锁定 */
  projectBible: ProjectBible;
  /** Phase 4 风格预设 */
  stylePresetId: StylePresetId;
  /** Phase 6 世界观 */
  worldBible: WorldBible;
  /** Phase 5 镜头模板 */
  cameraTemplateId: CameraTemplateId;
  /** Phase 8 一致性时间轴 */
  shotTimeline: Record<number, ShotTimelineEntry>;
  /** QC + 自动修复设置 */
  consistencySettings: ConsistencySettings;
  activeShotIdx: number;
  testResult: VeoTestResult | null;
  shotLock: ShotLockRecord | null;
  prodResult: string | null;
  /** 批量并行生成：是否进行中 */
  batchRunning: boolean;
  /** 批量并行生成：按镜头索引存放各镜头结果 */
  batchResults: Record<number, BatchShotState>;
  /** 图像批量生成：是否进行中（放 store 里，切页不丢进度） */
  imageBatchRunning: boolean;
  /** 图像批量生成：各镜头状态 */
  imageBatchStatus: Record<number, { status: "pending" | "generating" | "success" | "failed"; error?: string }>;
  export: ExportMeta;
  historyEntryId: string | null;
  /** 本项目 API 费用明细（编导 + 生图） */
  projectCostLedger: ProjectCostLedger | null;
  /** B 方案：Edit Graph 剪辑序列（Render Engine 兼容） */
  editSequence: import("@/app/lib/auto-edit/types").EditSequence | null;
  /** Edit Graph v2 — AI 剪辑中心单一真相源 */
  editGraph: import("@/app/lib/auto-edit/edit-graph/types").EditGraph | null;
  /** AI 剪辑方案（含说明） */
  editPlan: import("@/app/lib/auto-edit/types").EditPlan | null;
  /** AI Cut v3：Director Plan（AI 导演大脑输出，不含执行命令） */
  directorPlan: import("@/app/lib/director-plan/types").DirectorPlan | null;
  /** Clip Agent → OpenCut 执行命令 batch */
  openCutCommands: import("@/app/lib/opencut/commands").OpenCutCommand[] | null;
  /** 最近一次渲染任务 id */
  editRenderJobId: string | null;
  /** 自动剪辑成片 URL */
  finalEditVideoUrl: string | null;
  /** 自动剪辑成片模式（切换 Tab / 刷新后保留） */
  editRenderMode: import("@/app/lib/auto-edit/types").EditRenderMode;
  /** 剪辑成片背景音乐（/api/files/...） */
  editBgmUrl: string | null;
  /** 背景音乐音量 0–1 */
  editBgmVolume: number;
  /** Edge TTS 音色，默认中文女声 */
  editVoiceId: string;
  /** Render Engine 统一配置（字幕/配音/BGM/转场/特效/导出） */
  editEngineSettings: import("@/app/lib/auto-edit/engines/edit-settings").EditEngineSettings;
  editRendering: boolean;
  editError: string | null;
  /** 全局渲染进度（跨页面轮询同步） */
  editRenderProgress: { pct: number; message: string } | null;
  /** AI 自动剪辑生成的封面图 */
  editCoverImageUrl: string | null;
  /** 画布 / 剪辑中心 UI 状态（切换导航后保留） */
  canvasUi: CanvasUiState;
  error: string | null;
  directorLoading: boolean;
  veoLoading: boolean;
  veoStatus: VeoJobStatus;
  veoProgressStep: 1 | 2 | 3;
  veoStartedAt: string | null;
  veoError: string | null;
  veoSuccessMessage: string | null;
};
