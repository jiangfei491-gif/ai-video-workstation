import { executeOpenCutCommands } from "@/app/lib/opencut/client";
import type { OpenCutCommand } from "@/app/lib/opencut/commands";
import type { DirectorPlan } from "@/app/lib/director-plan/types";
import { directorPlanToOpenCutCommands } from "./plan-to-commands";
import type { ClipAgentOptions, ClipAgentResult } from "./types";

/**
 * Clip Agent — 执行者。
 * 将 Director Plan 翻译为 OpenCut 命令并 dispatch。
 */
export async function runClipAgent(
  plan: DirectorPlan,
  opts?: ClipAgentOptions
): Promise<ClipAgentResult> {
  const commands = directorPlanToOpenCutCommands(plan, {
    includeExport: opts?.includeExport,
  });
  const result = await executeOpenCutCommands(
    commands,
    opts?.projectName ?? plan.title
  );
  return {
    commands,
    traces: result.traces,
    projectSnapshot: result.project,
  };
}

export { directorPlanToOpenCutCommands };
export type { ClipAgentOptions, ClipAgentResult, CommandTrace } from "./types";

/** 调试：仅生成命令，不执行 */
export function previewCommands(
  plan: DirectorPlan,
  opts?: Pick<ClipAgentOptions, "includeExport">
): OpenCutCommand[] {
  return directorPlanToOpenCutCommands(plan, opts);
}
