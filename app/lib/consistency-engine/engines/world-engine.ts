import type { ComposeSectionBlock } from "../types/compose";
import type { WorldBible } from "../types/world-style-camera";

export function renderWorldBible(world: WorldBible): ComposeSectionBlock | null {
  const lines: string[] = [];
  if (world.era.trim()) lines.push(`Era: ${world.era.trim()}`);
  if (world.country.trim()) lines.push(`Country/region: ${world.country.trim()}`);
  if (world.city.trim()) lines.push(`City/setting: ${world.city.trim()}`);
  if (world.architecture.trim()) lines.push(`Architecture: ${world.architecture.trim()}`);
  if (world.transport.trim()) lines.push(`Transport: ${world.transport.trim()}`);
  if (world.currency.trim()) lines.push(`Currency/money: ${world.currency.trim()}`);
  if (world.signage.trim()) lines.push(`Signage/language: ${world.signage.trim()}`);
  if (world.uniforms.trim()) lines.push(`Uniforms/dress codes: ${world.uniforms.trim()}`);
  if (world.forbidden.trim()) lines.push(`World FORBIDDEN: ${world.forbidden.trim()}`);
  if (lines.length === 0) return null;
  return {
    section: "world_bible",
    title: "WORLD BIBLE — LOCKED",
    lines: [
      "All shots inherit this world. Do not introduce inconsistent era, location, or cultural elements.",
      ...lines,
    ],
  };
}
