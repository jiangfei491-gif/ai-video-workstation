import { getProp } from "@/app/lib/asset-library/prop-store";
import type { PropAsset } from "@/app/lib/asset-library/types";
import type { ComposeSectionBlock } from "../types/compose";

function traitLines(p: PropAsset): string[] {
  const lines: string[] = [];
  if (p.description.trim()) lines.push(p.description.trim());
  if (p.category?.trim()) lines.push(`Category: ${p.category.trim()}`);
  if (p.brand?.trim()) lines.push(`Brand/model: ${p.brand.trim()}`);
  if (p.color?.trim()) lines.push(`Color: ${p.color.trim()}`);
  if (p.material?.trim()) lines.push(`Material: ${p.material.trim()}`);
  if (p.forbiddenChanges?.trim()) lines.push(`FORBIDDEN changes: ${p.forbiddenChanges.trim()}`);
  if (p.refImageUrl) lines.push("Use exact prop appearance from reference lock.");
  return lines;
}

export function renderPropBible(propIds: string[]): ComposeSectionBlock[] {
  const blocks: ComposeSectionBlock[] = [];
  for (const id of propIds) {
    const p = getProp(id);
    if (!p) continue;
    const lines = traitLines(p);
    if (lines.length === 0) continue;
    blocks.push({
      section: "prop_bible",
      title: `PROP BIBLE — @${p.name}`,
      lines: [`Use @${p.name} only. Same prop across all shots unless delta says otherwise.`, ...lines],
    });
  }
  return blocks;
}

export function propTokens(propIds: string[]): string[] {
  return propIds
    .map((id) => getProp(id)?.name)
    .filter((n): n is string => !!n?.trim())
    .map((n) => `@${n}`);
}
