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
  activeShotIdx: number;
  testResult: VeoTestResult | null;
  shotLock: ShotLockRecord | null;
  prodResult: string | null;
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
