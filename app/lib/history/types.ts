import type { ExportMeta } from "@/app/lib/export/types";
import type { SeedMode } from "@/app/lib/generation-params";
import type { DirectorState, StoryboardShot } from "@/app/lib/workbench-persist/types";
import type { WorkspaceMode } from "@/app/lib/workspace-mode";

export type ImageStyle =
  | "realistic"
  | "anime"
  | "cinematic"
  | "advertising"
  | "illustration";

export type ImageAspectRatio = "1:1" | "9:16" | "16:9";
export type ImageClarity = "standard" | "hd" | "uhd";
export type VideoClarity = "standard" | "hd" | "uhd";

export type VideoHistoryEntry = {
  id: string;
  createdAt: string;
  topic: string;
  thumbnailBlobId: string;
  script: string;
  director: DirectorState;
  storyboard: StoryboardShot[];
  shotParams: {
    shotCount: number;
    shotDurationSec: number;
    fps: 24 | 30 | 60;
    aspectRatio: "9:16" | "16:9";
    clarity: VideoClarity;
    workspaceMode: WorkspaceMode;
    characterConsistency: boolean;
    sceneConsistency: boolean;
    seedMode?: SeedMode;
    seed: number | null;
  };
  status: "running" | "completed" | "failed";
  export?: ExportMeta;
  shots: Array<{
    sceneNumber: number;
    providerPrompt: string;
    veoPreviewBlobId: string | null;
    veoProductionBlobId: string | null;
    veoPreviewUrl: string | null;
    veoProductionUrl: string | null;
  }>;
};

export type ImageHistoryEntry = {
  id: string;
  createdAt: string;
  topic: string;
  prompt: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  clarity: ImageClarity;
  imageParams: {
    width: number;
    height: number;
    imageCount: number;
    seedMode?: SeedMode;
    seed: number | null;
  };
  thumbnailBlobId: string;
  export?: ExportMeta;
  images: Array<{
    id: string;
    blobId: string;
    publicUrl?: string;
    width: number;
    height: number;
  }>;
};

