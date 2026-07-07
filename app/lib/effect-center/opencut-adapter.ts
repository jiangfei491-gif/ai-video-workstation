import type { TimelineTransition } from "@/app/lib/auto-edit/edit-graph/types";
import type { OpenCutCommand } from "@/app/lib/opencut/commands";
import type { ClipEffectRecommendation, OpenCutEffectPayload } from "./types";

/** OpenCut Adapter — setTransition + 镜头特效元数据 */
export function buildOpenCutEffectPayload(params: {
  transitions: TimelineTransition[];
  clipEffects: ClipEffectRecommendation[];
}): OpenCutEffectPayload {
  const commands: OpenCutCommand[] = params.transitions
    .filter((t) => t.type !== "cut" && t.durationMs > 0)
    .map((t) => ({
      action: "setTransition" as const,
      afterClipId: t.afterClipId,
      type: t.type,
      durationMs: t.durationMs,
    }));

  return {
    transitions: params.transitions,
    effectHints: params.clipEffects,
    commands,
  };
}
