/** Consistency Engine V2 路线图 — 单一真相源 */

export const ENGINE_VERSION = "2.1.0";

export type EnginePhase = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type PhaseModule = {
  id: string;
  phase: EnginePhase;
  priority: "P0" | "P1" | "P2";
  name: string;
  status: "done" | "partial" | "stub" | "planned";
};

export const ENGINE_MODULES: PhaseModule[] = [
  { id: "project_bible", phase: 1, priority: "P0", name: "Project Bible", status: "done" },
  { id: "character_bible", phase: 1, priority: "P0", name: "Character Bible", status: "done" },
  { id: "scene_bible", phase: 1, priority: "P0", name: "Scene Bible", status: "done" },
  { id: "prop_bible", phase: 1, priority: "P0", name: "Prop Bible", status: "done" },
  { id: "prompt_composer", phase: 1, priority: "P0", name: "Prompt Composer", status: "done" },
  { id: "shot_delta", phase: 1, priority: "P0", name: "Shot Delta", status: "done" },
  { id: "shot_memory", phase: 1, priority: "P0", name: "Shot Memory", status: "done" },
  { id: "visual_qc", phase: 2, priority: "P0", name: "Visual QC Engine", status: "done" },
  { id: "character_reference", phase: 3, priority: "P1", name: "Character Reference Engine", status: "done" },
  { id: "style_engine", phase: 4, priority: "P1", name: "Style Engine", status: "done" },
  { id: "camera_engine", phase: 5, priority: "P1", name: "Camera Engine", status: "done" },
  { id: "world_engine", phase: 6, priority: "P1", name: "World Engine", status: "done" },
  { id: "prop_engine", phase: 7, priority: "P1", name: "Prop Engine (extended)", status: "done" },
  { id: "consistency_timeline", phase: 8, priority: "P2", name: "Consistency Timeline", status: "done" },
  { id: "model_performance", phase: 9, priority: "P2", name: "Model Performance Engine", status: "done" },
  { id: "auto_repair", phase: 10, priority: "P2", name: "Auto Repair Engine", status: "done" },
  { id: "tiered_image_pipeline", phase: 11, priority: "P0", name: "Tiered Image Pipeline (FLUX→Score→Premium→QC)", status: "done" },
  { id: "score_qc", phase: 11, priority: "P0", name: "10-Dimension Score QC", status: "done" },
  { id: "image_providers", phase: 11, priority: "P0", name: "Image Provider Layer (FLUX/OpenAI/Imagen)", status: "done" },
];

export function phaseProgress(): { done: number; total: number; pct: number } {
  const total = ENGINE_MODULES.length;
  const done = ENGINE_MODULES.filter((m) => m.status === "done").length;
  const partial = ENGINE_MODULES.filter((m) => m.status === "partial" || m.status === "stub").length;
  return {
    done: done + partial * 0.5,
    total,
    pct: Math.round(((done + partial * 0.5) / total) * 100),
  };
}
