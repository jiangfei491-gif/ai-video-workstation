import type { DirectorState } from "@/app/lib/workbench-persist/types";

/** 生图任务优先级（Image Budget Planner 未来使用） */
export type ImageTaskPriority = "critical" | "normal" | "support";

/**
 * ImageTask — 生图任务单元（≠ Storyboard / Narrative Shot）。
 * 多个 Narrative Shot 可映射到同一 ImageTask。
 */
export type ImageTask = {
  imageTaskId: string;
  primaryShotId: string;
  supportingShotIds: string[];
  /** 关联的 storyboard 数组索引（兼容期 1:1 时仅一个） */
  sourceShotIndexes: number[];
  character: string;
  actionCoverage: string[];
  environment: string;
  cameraIntent: string;
  visualFocus: string[];
  priority: ImageTaskPriority;
  budgetReason: string;
  /** 兼容期从 generateProviderPrompts 复制；未来由 ImageTask Prompt Compiler 生成 */
  providerPrompt?: string;
};

/** Shot ↔ ImageTask 显式映射 */
export type ImageTaskMapping = {
  /** SHOT_001 → IMAGE_TASK_001 */
  shotToImageTaskMap: Record<string, string>;
  /** IMAGE_TASK_001 → [SHOT_001, SHOT_002, …] */
  imageTaskToShotIds: Record<string, string[]>;
};

export type BuildCompatImageTasksInput = {
  director: DirectorState;
};

export type BuildCompatImageTasksResult = {
  imageTasks: ImageTask[];
  mapping: ImageTaskMapping;
  /** storyboard 条目附带 shotId */
  storyboardWithShotIds: DirectorState["storyboard"];
};
