import type { DirectorStoryboardShot } from "@/app/lib/director/types";
import type { ImageTask } from "./types";

export type ComposeImageTaskPromptContext = {
  projectStyle?: string;
  previousShotSummary?: string;
};

/**
 * 聚合 primary + supporting Shots，生成高复用 ImageTask Prompt。
 * 目标：一张图服务多个 Narrative Shot，保留安全构图空间。
 */
export function composeImageTaskPrompt(
  task: ImageTask,
  storyboard: DirectorStoryboardShot[],
  ctx?: ComposeImageTaskPromptContext
): string {
  const lookup = new Map<string, DirectorStoryboardShot>();
  storyboard.forEach((s, i) => {
    const id = s.shotId ?? `SHOT_${String(i + 1).padStart(3, "0")}`;
    lookup.set(id, s);
  });

  const primary = lookup.get(task.primaryShotId);
  const supporting = task.supportingShotIds
    .map((id) => lookup.get(id))
    .filter(Boolean) as DirectorStoryboardShot[];

  const actions = task.actionCoverage.length
    ? task.actionCoverage
    : [primary?.action, ...supporting.map((s) => s.action)].filter(Boolean);

  const focuses = task.visualFocus.length
    ? task.visualFocus
    : [primary?.visualFocus, ...supporting.map((s) => s.visualFocus)].filter(Boolean);

  const env = task.environment || primary?.environment || "scene";
  const character = task.character || primary?.character || "subject";
  const camera = task.cameraIntent || primary?.camera || "medium shot";

  const coverageBlock =
    supporting.length > 0
      ? [
          "This single still must cover multiple narrative beats:",
          `- Primary: ${primary?.action ?? actions[0] ?? ""}`,
          ...supporting.map((s, i) => `- Supporting ${i + 1}: ${s.action}`),
          "Compose so all listed actions/foci can be served by one image with safe reframing room.",
        ].join("\n")
      : `Primary action: ${primary?.action ?? actions[0] ?? ""}.`;

  const compositionRules = [
    "Composition requirements:",
    "- Subject not cropped at frame edges; leave headroom and side margins.",
    "- If hands or held objects matter, keep hands and key props visible and readable.",
    "- Balance character and environment; allow medium/close reframing in post.",
    "- Clear visual hierarchy for: " + focuses.slice(0, 4).join(", "),
  ].join("\n");

  const lines = [
    "Inherit locked project style, character, and scene identity.",
    ctx?.projectStyle ? `Style DNA: ${ctx.projectStyle.trim()}.` : "",
    ctx?.previousShotSummary ? `Previous shot context: ${ctx.previousShotSummary}.` : "",
    `Character: ${character}. Environment: ${env}.`,
    coverageBlock,
    `Camera intent: ${camera}.`,
    `Visual focus: ${focuses.slice(0, 5).join("; ")}.`,
    compositionRules,
    task.priority === "critical"
      ? "Critical story beat — ensure key reveal/prop/emotion reads clearly."
      : "",
    "Do not change face, hair, clothing, or scene identity.",
  ].filter(Boolean);

  return lines.join("\n");
}
