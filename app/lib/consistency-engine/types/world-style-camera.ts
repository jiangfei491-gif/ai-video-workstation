/** Phase 4 — Style Engine 预设 ID */
export type StylePresetId =
  | "custom"
  | "bbc_documentary"
  | "netflix_drama"
  | "natgeo"
  | "news_report"
  | "cinematic_film";

/** Phase 5 — Camera Engine 模板 ID */
export type CameraTemplateId =
  | "medium_shot"
  | "close_up"
  | "wide_shot"
  | "overhead"
  | "tracking"
  | "push_in"
  | "pull_back"
  | "handheld";

/** Phase 6 — World Bible */
export type WorldBible = {
  era: string;
  country: string;
  city: string;
  architecture: string;
  transport: string;
  currency: string;
  signage: string;
  uniforms: string;
  forbidden: string;
};

export const DEFAULT_WORLD_BIBLE: WorldBible = {
  era: "",
  country: "",
  city: "",
  architecture: "",
  transport: "",
  currency: "",
  signage: "",
  uniforms: "",
  forbidden: "no foreign architecture, no wrong era vehicles, no incorrect currency or signage",
};

import type { QCVerdict } from "./qc";
import type { ScoreQCResult } from "../qc/score-qc";
import type { QualityMode } from "@/app/lib/image/providers/types";

/** Phase 8 — 单镜时间轴记录 */
export type ShotTimelineEntry = {
  shotIndex: number;
  composedPrompt: string;
  finalPrompt: string;
  frameUrl: string;
  assetId: string;
  model: string;
  referencePaths: string[];
  qc?: QCVerdict;
  /** Tier 2 十维评分 */
  score?: ScoreQCResult;
  repairAttempts: number;
  deltaChanges: string[];
  qualityMode?: QualityMode;
  upgradedToPremium?: boolean;
  totalCostUsd?: number;
  draftModel?: string;
  createdAt: string;
};

/** 工作台一致性 + 四级生图设置 */
export type ConsistencySettings = {
  qcEnabled: boolean;
  autoRepair: boolean;
  maxRepairAttempts: number;
  /** 极速 / 标准 / 旗舰 */
  qualityMode: QualityMode;
  /** Tier 2 淘汰阈值 */
  scoreThreshold: number;
  /** 标准/旗舰是否启用 Tier3 精修 */
  premiumEnabled: boolean;
};

export const DEFAULT_CONSISTENCY_SETTINGS: ConsistencySettings = {
  qcEnabled: true,
  autoRepair: true,
  maxRepairAttempts: 2,
  qualityMode: "standard",
  scoreThreshold: 90,
  premiumEnabled: true,
};
