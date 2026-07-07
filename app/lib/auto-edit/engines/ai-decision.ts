import type { EditPlan } from "../types";
import type { EditSequence } from "../types";
import type { ShotDecision } from "./types";

/** 从 AI 剪辑方案提取「为什么这样剪」（Client / Server 均可） */
export function extractShotDecisions(
  plan: EditPlan,
  sequence: EditSequence
): ShotDecision[] {
  const out: ShotDecision[] = [];
  const rationale = plan.clipRationale ?? {};

  for (const key of sequence.playOrder) {
    const clip = sequence.clips[key];
    if (!clip) continue;
    const r = rationale[key];
    out.push({
      key,
      shotIndex: clip.shotIndex,
      label: clip.label,
      durationSec: clip.durationSec,
      suggestedDurationSec: r?.durationSec,
      reason: r?.reason ?? "默认分镜时长",
      tags: r?.tags,
    });
  }
  return out;
}
