import type { GenerationMode } from "@/app/lib/generation-mode";
import type { WorkspaceMode } from "@/app/lib/workspace-mode";

export type CharacterProfileSnapshot = {
  id: string;
  name: string;
  description: string;
  veoPromptSuffix?: string;
};

export type CameraProfileSnapshot = {
  id: string;
  name: string;
  shotType: string;
  movement: string;
  lens?: string;
  veoPromptSuffix?: string;
};

/** Shot Lock 不可变快照 */
export type ShotLockSnapshot = {
  shotId: string;
  prompt: string;
  seed: number;
  firstFrameAssetId: string;
  firstFrameUrl: string;
  duration: number;
  aspectRatio: "9:16" | "16:9";
  model: string;
  characterProfile: CharacterProfileSnapshot | null;
  cameraProfile: CameraProfileSnapshot | null;
  imageAssetId?: string;
  lockedAt: string;
  testTaskId: string;
  testClipUrl: string;
};

export type ShotLockRecord = {
  id: string;
  shotId: string;
  snapshot: ShotLockSnapshot;
  productionTaskId?: string;
  productionClipUrl?: string;
};

export type CreateShotLockInput = {
  shotId: string;
  prompt: string;
  seed: number;
  firstFrameAssetId: string;
  firstFrameUrl: string;
  duration: number;
  aspectRatio: "9:16" | "16:9";
  model: string;
  characterProfile?: CharacterProfileSnapshot | null;
  cameraProfile?: CameraProfileSnapshot | null;
  imageAssetId?: string;
  testTaskId: string;
  testClipUrl: string;
};

export type VeoGenerateRequest = {
  shotId: string;
  workspaceMode: WorkspaceMode;
  mode: GenerationMode;
  type: "t2v" | "i2v";
  prompt: string;
  durationSec?: number;
  aspectRatio?: "9:16" | "16:9";
  model?: string;
  seed?: number;
  imageAssetId?: string;
  imageBase64?: string;
  shotLockId?: string;
};
