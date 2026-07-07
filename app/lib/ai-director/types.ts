import type { BatchImagePipelineResult } from "./run-batch-images";
import type { AiCutPipelineResult } from "@/app/lib/ai-cut/run-pipeline";
import type { AutoEditPipelineResult } from "@/app/lib/auto-edit/run-auto-edit-pipeline";
import type { DirectorPipelineResult } from "@/app/lib/director/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export type AiDirectorPhase = "director" | "media" | "edit" | "plan";

export type AiDirectorStepStatus = "running" | "done" | "skipped" | "failed";

export type AiDirectorOrchestratorStep = {
  id: string;
  phase: AiDirectorPhase;
  label: string;
  status: AiDirectorStepStatus;
  message: string;
  at: string;
};

export type AiDirectorRunOptions = {
  /** 已有分镜时仍重新跑编导（标题/脚本/分镜/Prompt） */
  forceRerunDirector?: boolean;
  /** 已有 EditGraph 时仍重新编排时间线 */
  forceRerunEdit?: boolean;
  /** 已有 Director Plan 时仍重新生成方案 */
  forceRerunPlan?: boolean;
  /** 重新编导时清空已生成的镜头图/视频（默认 false） */
  clearGeneratedMedia?: boolean;
  /** 生成 EditGraph 时间线（配音/字幕/BGM 等） */
  runEditGraph?: boolean;
  /** 生成 Director Plan + Clip Agent 命令 */
  runDirectorPlan?: boolean;
  /** 文生图模式：编导后批量生成镜头图（默认 t2i 开启） */
  runBatchImages?: boolean;
  /** 已有镜头图时仍全部重生成 */
  forceRerunImages?: boolean;
  /** 暂停后续跑：跳过已完成的阶段（参数变更时由客户端裁剪） */
  resumeFromPhases?: AiDirectorPhase[];
  /** 暂停后续跑：编导输入相对暂停时已变更 → 强制重跑编导 */
  directorParamsChanged?: boolean;
  /** 暂停后续跑：剪辑引擎设置已变更 → 不跳过剪辑编排 */
  editSettingsChanged?: boolean;
};

export type AiDirectorRunResult = {
  taskId: string;
  status: "success" | "partial" | "failed";
  steps: AiDirectorOrchestratorStep[];
  workbenchPatch: Partial<T2VWorkbenchState>;
  directorResult?: DirectorPipelineResult;
  batchImages?: BatchImagePipelineResult;
  autoEdit?: AutoEditPipelineResult;
  aiCut?: AiCutPipelineResult;
  error?: string;
};

export const DEFAULT_AI_DIRECTOR_RUN_OPTIONS: AiDirectorRunOptions = {
  forceRerunDirector: false,
  forceRerunEdit: false,
  forceRerunPlan: false,
  clearGeneratedMedia: false,
  runEditGraph: true,
  runDirectorPlan: true,
};
