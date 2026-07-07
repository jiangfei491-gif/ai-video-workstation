import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

/** 影响「编导 / 生图」阶段的输入指纹 — 暂停后若变化则续跑时重跑对应阶段 */
export function directorInputsFingerprint(state: T2VWorkbenchState): string {
  const isT2i = state.pipelineMode === "t2i";
  return JSON.stringify({
    topic: state.topic?.trim() ?? "",
    ...(isT2i
      ? {
          targetDurationMinutes: state.targetDurationMinutes ?? 1,
          imageBudget: state.imageBudget,
          imageBudgetMode: state.imageBudgetMode,
        }
      : {
          shotCount: state.shotCount,
          shotDurationSec: state.shotDurationSec,
        }),
    pipelineMode: state.pipelineMode,
    aspectRatio: state.aspectRatio,
    clarity: state.clarity,
    sourceScript: state.sourceScript?.trim() ?? "",
    sourceScriptLabel: state.sourceScriptLabel?.trim() ?? "",
    characterIds: [...(state.characterIds ?? [])].sort(),
    sceneIds: [...(state.sceneIds ?? [])].sort(),
    propIds: [...(state.propIds ?? [])].sort(),
    projectStyle: state.projectStyle?.trim() ?? "",
  });
}

/** 影响剪辑编排的引擎设置指纹 */
export function editSettingsFingerprint(state: T2VWorkbenchState): string {
  return JSON.stringify(state.editEngineSettings ?? {});
}
