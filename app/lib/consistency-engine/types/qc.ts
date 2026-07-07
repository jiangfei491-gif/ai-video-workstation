/** Phase 2 — Visual QC Engine（骨架，待接入视觉模型） */

import type { ApiUsage } from "@/app/lib/cost-ledger/types";

export type QCDimension =
  | "character"
  | "scene"
  | "cinematography"
  | "style"
  | "realism";

export type QCScores = {
  overall: number;
  character: number;
  scene: number;
  cinematography: number;
  style: number;
  realism: number;
};

export type QCThresholds = {
  overall: number;
  character: number;
  scene: number;
  cinematography: number;
  style: number;
  realism: number;
};

export const DEFAULT_QC_THRESHOLDS: QCThresholds = {
  overall: 85,
  character: 90,
  scene: 85,
  cinematography: 80,
  style: 85,
  realism: 80,
};

export type QCVerdict = {
  passed: boolean;
  scores: QCScores;
  failedDimensions: QCDimension[];
  repairHints: string[];
  usage?: ApiUsage;
};
