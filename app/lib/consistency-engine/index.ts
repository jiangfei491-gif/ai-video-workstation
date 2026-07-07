export {
  ENGINE_VERSION,
  ENGINE_MODULES,
  phaseProgress,
  type EnginePhase,
  type PhaseModule,
} from "./roadmap";

export type {
  ProjectBible,
  BibleRefs,
  ShotDelta,
  ShotMemory,
  ShotConsistencyMeta,
  AspectRatio,
  ComposeInput,
  ComposeResult,
  ComposeSection,
  ComposeSectionBlock,
  QCDimension,
  QCScores,
  QCThresholds,
  QCVerdict,
  StylePresetId,
  CameraTemplateId,
  WorldBible,
  ShotTimelineEntry,
  ConsistencySettings,
} from "./types";

export {
  DEFAULT_PROJECT_BIBLE,
  DEFAULT_QC_THRESHOLDS,
  DEFAULT_WORLD_BIBLE,
  DEFAULT_CONSISTENCY_SETTINGS,
  shotDeltaFromMeta,
  metaFromDelta,
  EMPTY_BIBLE_REFS,
} from "./types";

export {
  composeFinalPrompt,
  composeShotPrompt,
  PROMPT_FORMULA,
} from "./composer/prompt-composer";

export { buildShotMemory, buildPreviousShotSummary } from "./memory/shot-memory";
export { inferShotConsistencyMeta } from "./memory/infer-shot-meta";

export { renderCharacterBible, characterTokens } from "./bibles/character-bible";
export { renderSceneBible, sceneToken } from "./bibles/scene-bible";
export { renderPropBible, propTokens } from "./bibles/prop-bible";
export { renderProjectBible } from "./bibles/project-bible";

export { STYLE_PRESETS, getStylePreset, renderStyleBible } from "./engines/style-engine";
export { CAMERA_TEMPLATES, getCameraTemplate, renderCameraBible } from "./engines/camera-engine";
export { renderWorldBible } from "./engines/world-engine";

export { collectReferencePaths } from "./reference/collect-refs";
export { generateImageWithReferences } from "./reference/generate-with-refs";

export { runVisualQC, shouldAutoRepair } from "./qc/visual-qc";
export { runScoreQC, pickBestScored } from "./qc/score-qc";
export type { ScoreQCResult, ScoreBreakdown } from "./qc/score-qc";
export { buildRepairPrompt } from "./repair/auto-repair";

export { runConsistencyShotPipeline } from "./pipeline/run-shot-pipeline";
export { runTieredShotPipeline } from "./pipeline/run-tiered-shot-pipeline";

export {
  recordModelPerformance,
  getModelPerformanceStats,
  recommendModel,
  recommendTieredStrategy,
} from "./performance/model-performance-store";
export type { ModelStats } from "./performance/model-performance-store";

export { getProviderAvailability } from "@/app/lib/image/providers/router";
export type { QualityMode, ImageProviderId } from "@/app/lib/image/providers/types";

/** 客户端专用 — 不含 fs/store */
export { buildShotFrameRequest } from "./client/build-shot-frame-request";
