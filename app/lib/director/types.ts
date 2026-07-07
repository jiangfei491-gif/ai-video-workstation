import type { DirectorCostDetail } from "@/app/lib/cost-ledger/types";

/** 导演分镜单镜头（Narrative Shot / Storyboard Shot，≠ ImageTask） */
export type DirectorStoryboardShot = {
  sceneNumber: number;
  duration: number;
  /** 叙事镜头 id */
  shotId?: string;
  /** 所属 Narrative Beat */
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
  /** Beat 级旁白引用 */
  narrationRef?: string;
};

/** Veo 视频生成 Prompt（每镜头一条） */
export type DirectorProviderPrompt = {
  sceneNumber: number;
  providerPrompt: string;
};

/** AI 推断的全局视觉设定 */
export type DirectorVisualSettings = {
  projectBible: {
    videoType: string;
    colorTone: string;
    cameraLanguage: string;
    lightingRules: string;
    forbidden: string;
  };
  projectStyle: string;
  stylePresetId: import("@/app/lib/consistency-engine/types/world-style-camera").StylePresetId;
  worldBible: import("@/app/lib/consistency-engine/types/world-style-camera").WorldBible;
  cameraTemplateId: import("@/app/lib/consistency-engine/types/world-style-camera").CameraTemplateId;
};

/** POST /api/director 完整返回 */
export type DirectorPipelineResult = {
  title: string;
  script: string;
  storyboard: DirectorStoryboardShot[];
  prompts: DirectorProviderPrompt[];
  shotConsistency?: import("@/app/lib/consistency/types").ShotConsistencyMeta[];
  visualSettings?: DirectorVisualSettings;
  costDetail?: DirectorCostDetail;
  /** t2i Narrative 链路 */
  narrativeBeats?: import("@/app/lib/narrative/types").NarrativeBeat[];
  imageTasks?: import("@/app/lib/image-task/types").ImageTask[];
  imageTaskMapping?: import("@/app/lib/image-task/types").ImageTaskMapping;
  imageBudgetPlannerMode?: "gpt" | "rule-fallback";
};

export type DirectorPipelineInput = {
  topic: string;
  /** t2v：镜头数 */
  shotCount?: number;
  shotDurationSec?: number;
  imageBudget?: number;
  targetDurationMinutes?: number;
  script?: string;
  title?: string;
  outputMode?: "image" | "video";
  characterIds?: string[];
  sceneIds?: string[];
  propIds?: string[];
  projectBible?: {
    videoType?: string;
    colorTone?: string;
    cameraLanguage?: string;
    lightingRules?: string;
    forbidden?: string;
  };
  projectStyle?: string;
};

export type DirectorPipelineStep =
  | "title"
  | "script"
  | "visual-settings"
  | "storyboard"
  | "prompts";

export type DirectorProgressCallback = (
  step: DirectorPipelineStep,
  message: string
) => void;
