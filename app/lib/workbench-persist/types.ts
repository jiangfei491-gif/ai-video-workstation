import type { GenerationMode } from "@/app/lib/generation-mode";
import type { SeedMode } from "@/app/lib/generation-params";
import type { ExportMeta } from "@/app/lib/export/types";
import type { ShotLockRecord } from "@/app/lib/shot-lock";
import type { ShotCount, ShotDurationSec } from "@/app/lib/shot-control/types";
import type { WorkspaceMode } from "@/app/lib/workspace-mode";

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
  error?: string;
};

export type StoryboardShot = {
  sceneNumber: number;
  duration: number;
  character: string;
  action: string;
  environment: string;
  camera: string;
  narration: string;
};

export type DirectorShot = {
  sceneNumber: number;
  providerPrompt: string;
  duration: number;
};

export type DirectorState = {
  title: string;
  script: string;
  storyboard: StoryboardShot[];
  prompts: DirectorShot[];
};

export type VideoClarity = "standard" | "hd" | "uhd";
export type VideoFps = 24 | 30 | 60;

export type T2VWorkbenchState = {
  topic: string;
  shotCount: ShotCount;
  shotDurationSec: ShotDurationSec;
  fps: VideoFps;
  aspectRatio: "9:16" | "16:9";
  clarity: VideoClarity;
  workspaceMode: WorkspaceMode;
  characterConsistency: boolean;
  sceneConsistency: boolean;
  seedMode: SeedMode;
  seed: number | null;
  voiceoverText: string;
  subtitleText: string;
  mode: GenerationMode;
  director: DirectorState | null;
  /** 本项目导入的角色 id（来自角色库，移除仅移出项目、不删仓库） */
  characterIds: string[];
  /** 项目画布：卡片位置（key 如 shot-0 / char-<id>） */
  canvasPositions: Record<string, { x: number; y: number }>;
  /** 项目画布：角色→分镜的选角连线 */
  canvasLinks: { charId: string; shotIdx: number }[];
  /** 项目画布：各分镜就地生成的首帧图 url（按镜头索引） */
  shotFrames: Record<number, string>;
  activeShotIdx: number;
  testResult: VeoTestResult | null;
  shotLock: ShotLockRecord | null;
  prodResult: string | null;
  /** 批量并行生成：是否进行中 */
  batchRunning: boolean;
  /** 批量并行生成：按镜头索引存放各镜头结果 */
  batchResults: Record<number, BatchShotState>;
  export: ExportMeta;
  historyEntryId: string | null;
  error: string | null;
  directorLoading: boolean;
  veoLoading: boolean;
  veoStatus: VeoJobStatus;
  veoProgressStep: 1 | 2 | 3;
  veoStartedAt: string | null;
  veoError: string | null;
  veoSuccessMessage: string | null;
};
