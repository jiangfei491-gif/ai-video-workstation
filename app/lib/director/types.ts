/** 导演分镜单镜头 */
export type DirectorStoryboardShot = {
  sceneNumber: number;
  duration: number;
  character: string;
  action: string;
  environment: string;
  camera: string;
  transition: string;
  narration: string;
};

/** Veo 视频生成 Prompt（每镜头一条） */
export type DirectorProviderPrompt = {
  sceneNumber: number;
  providerPrompt: string;
};

/** POST /api/director 完整返回 */
export type DirectorPipelineResult = {
  title: string;
  script: string;
  storyboard: DirectorStoryboardShot[];
  prompts: DirectorProviderPrompt[];
};

export type DirectorPipelineInput = {
  topic: string;
  /** 镜头数量，默认 5 */
  shotCount?: number;
};

export type DirectorPipelineStep =
  | "title"
  | "script"
  | "storyboard"
  | "prompts";

export type DirectorProgressCallback = (
  step: DirectorPipelineStep,
  message: string
) => void;
