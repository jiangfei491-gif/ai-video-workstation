import type { ProjectBible } from "../types/bibles";
import type { ComposeSectionBlock } from "../types/compose";

export function renderProjectBible(
  bible: ProjectBible,
  aspectRatio: string,
  projectStyle?: string
): ComposeSectionBlock {
  const lines: string[] = [];
  if (bible.videoType.trim()) lines.push(`Video type: ${bible.videoType.trim()}`);
  lines.push(`Aspect ratio: ${aspectRatio}`);
  if (bible.colorTone.trim()) lines.push(`Color grade: ${bible.colorTone.trim()}`);
  if (bible.cameraLanguage.trim()) lines.push(`Camera language: ${bible.cameraLanguage.trim()}`);
  if (bible.lightingRules.trim()) lines.push(`Lighting rules: ${bible.lightingRules.trim()}`);
  if (projectStyle?.trim()) lines.push(`Style DNA: ${projectStyle.trim()}`);
  if (bible.forbidden.trim()) lines.push(`Global FORBIDDEN: ${bible.forbidden.trim()}`);
  return {
    section: "project_bible",
    title: "PROJECT BIBLE — LOCKED",
    lines,
  };
}
