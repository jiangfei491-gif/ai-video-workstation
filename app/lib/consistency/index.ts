/**
 * @deprecated 请改用 `@/app/lib/consistency-engine`
 * 此目录保留薄 re-export，避免散落 import 断裂。
 */
export {
  ENGINE_VERSION,
  ENGINE_MODULES,
  phaseProgress,
  DEFAULT_PROJECT_BIBLE,
  DEFAULT_QC_THRESHOLDS,
  composeFinalPrompt,
  composeShotPrompt,
  PROMPT_FORMULA,
  buildShotMemory,
  buildPreviousShotSummary,
  inferShotConsistencyMeta,
  buildShotFrameRequest,
  runVisualQC,
  shouldAutoRepair,
} from "@/app/lib/consistency-engine";

export type {
  ProjectBible,
  ShotConsistencyMeta,
  ShotDelta,
  ShotMemory,
  ComposeInput,
  ComposeResult,
  QCVerdict,
  QCScores,
} from "@/app/lib/consistency-engine";
