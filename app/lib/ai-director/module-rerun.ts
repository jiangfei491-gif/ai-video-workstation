import type { ModuleId } from "@/app/lib/platform";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import type { AiDirectorRunOptions } from "./types";

/** 按模块生成重跑选项；返回 null 表示该模块不支持一键重跑 */
export function buildModuleRerunOptions(
  moduleId: ModuleId,
  base: AiDirectorRunOptions,
  state: T2VWorkbenchState
): AiDirectorRunOptions | null {
  const common = {
    ...base,
    runEditGraph: base.runEditGraph !== false,
    runDirectorPlan: base.runDirectorPlan !== false,
  };

  switch (moduleId) {
    case "ai-director":
      return { ...common, forceRerunPlan: true };
    case "video-creation-script":
      return { ...common, forceRerunDirector: true };
    case "video-creation-media":
      if (state.pipelineMode !== "t2i") return null;
      return {
        ...common,
        runBatchImages: true,
        forceRerunImages: true,
      };
    case "voice-center":
    case "subtitle-center":
    case "music-center":
    case "effect-center":
      return { ...common, forceRerunEdit: true };
    default:
      return null;
  }
}

/** 分镜与剪辑工程不一致时，仅重编 EditGraph + Director Plan */
export function buildAlignDownstreamOptions(base: AiDirectorRunOptions): AiDirectorRunOptions {
  return {
    ...base,
    forceRerunDirector: false,
    forceRerunImages: false,
    runBatchImages: false,
    forceRerunEdit: true,
    forceRerunPlan: true,
    runEditGraph: true,
    runDirectorPlan: true,
  };
}

export function moduleRerunDisabledReason(
  moduleId: ModuleId,
  state: T2VWorkbenchState
): string | null {
  if (moduleId === "material-center") return "内容中心请手动导入或改写脚本";
  if (moduleId === "video-creation-media" && state.pipelineMode !== "t2i") {
    return "当前为图生视频模式，请到创作中心生成画面";
  }
  if (!state.topic?.trim()) return "请先填写视频主题";
  return null;
}
