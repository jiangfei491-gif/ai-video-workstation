import { getCharacter } from "@/app/lib/asset-library/character-store";
import type { CharacterAsset } from "@/app/lib/asset-library/types";
import type { ComposeSectionBlock } from "../types/compose";

function traitLines(c: CharacterAsset): string[] {
  const lines: string[] = [];
  if (c.appearance.trim()) lines.push(c.appearance.trim());
  if (c.age?.trim()) lines.push(`Age: ${c.age.trim()}`);
  if (c.gender?.trim()) lines.push(`Gender: ${c.gender.trim()}`);
  if (c.hair?.trim()) lines.push(`Hair: ${c.hair.trim()}`);
  if (c.clothing?.trim()) lines.push(`Clothing: ${c.clothing.trim()}`);
  if (c.bodyType?.trim()) lines.push(`Body: ${c.bodyType.trim()}`);
  if (c.facialFeatures?.trim()) lines.push(`Face: ${c.facialFeatures.trim()}`);
  if (c.colorPalette?.trim()) lines.push(`Palette: ${c.colorPalette.trim()}`);
  if (c.forbiddenChanges?.trim()) lines.push(`FORBIDDEN changes: ${c.forbiddenChanges.trim()}`);
  if (c.refImageUrl) lines.push("Use exact face and outfit from character reference lock.");
  return lines;
}

export function renderCharacterBible(characterIds: string[]): ComposeSectionBlock[] {
  const blocks: ComposeSectionBlock[] = [];
  for (const id of characterIds) {
    const c = getCharacter(id);
    if (!c) continue;
    const lines = traitLines(c);
    if (lines.length === 0) continue;
    blocks.push({
      section: "character_bible",
      title: `CHARACTER BIBLE — @${c.name}`,
      lines: [`Use @${c.name} only. Do not re-describe as "a woman" or generic terms.`, ...lines],
    });
  }
  return blocks;
}

export function characterTokens(characterIds: string[]): string[] {
  return characterIds
    .map((id) => getCharacter(id)?.name)
    .filter((n): n is string => !!n?.trim())
    .map((n) => `@${n}`);
}

/** @deprecated */
export function buildCharacterLockBlocks(characterIds: string[]) {
  return renderCharacterBible(characterIds).map((b) => ({
    token: b.title.match(/@(\S+)/)?.[1] ? `@${b.title.match(/@(\S+)/)![1]}` : "",
    lines: b.lines,
  }));
}
