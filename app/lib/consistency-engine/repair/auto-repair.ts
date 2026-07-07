import type { QCVerdict } from "../types/qc";

/** Phase 10 — 根据 QC 结果追加修复 delta */
export function buildRepairPrompt(basePrompt: string, verdict: QCVerdict): string {
  const hints = verdict.repairHints.slice(0, 4).join("; ");
  const failed = verdict.failedDimensions.join(", ");
  return [
    basePrompt,
    "",
    "[AUTO REPAIR — fix drift only]",
    `Failed dimensions: ${failed || "general"}.`,
    `Repair: ${hints}.`,
    "Keep scene composition and unchanged elements identical. Only fix listed drift.",
  ].join("\n");
}

export type RepairAttempt = {
  attempt: number;
  qc: QCVerdict;
  prompt: string;
};
