import type { ComposeSectionBlock } from "../types/compose";
import type { ShotDelta, ShotMemory } from "../types/shot";

export function renderShotMemory(memory: ShotMemory, shotIndex: number): ComposeSectionBlock {
  const from = memory.inheritFrom;
  return {
    section: "shot_memory",
    title: from != null ? `SHOT MEMORY — inherit from shot ${from + 1}` : "SHOT MEMORY — series start",
    lines: [
      memory.summary.trim(),
      "Maintain: same character face, hair, clothing, props, location, time of day, color grade, project style.",
      `Current shot index: ${shotIndex + 1}.`,
    ],
  };
}

export function renderShotDelta(delta: ShotDelta, shotIndex: number): ComposeSectionBlock {
  const lines: string[] = [];
  if (delta.action.trim()) lines.push(`Action change: ${delta.action.trim()}`);
  if (delta.camera.trim()) lines.push(`Camera: ${delta.camera.trim()}`);
  if (delta.lighting.trim()) {
    lines.push(
      delta.lighting.trim().toLowerCase() === "same as previous"
        ? "Lighting: same as previous shot."
        : `Lighting: ${delta.lighting.trim()}`
    );
  }
  if (delta.extraPrompt?.trim()) lines.push(delta.extraPrompt.trim());
  if (lines.length === 0) lines.push("(no delta specified — hold previous state)");
  return {
    section: "shot_delta",
    title: `SHOT ${shotIndex + 1} — DELTA ONLY`,
    lines,
  };
}

export function renderConstraints(): ComposeSectionBlock {
  return {
    section: "constraints",
    title: "CONSTRAINTS",
    lines: [
      "Do NOT change: character identity, face, hairstyle, clothing, prop identity, scene identity, time period, or overall color grade unless explicitly listed in DELTA.",
    ],
  };
}
