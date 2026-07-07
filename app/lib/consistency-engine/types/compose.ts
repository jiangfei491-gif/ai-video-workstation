import type { ProjectBible } from "./bibles";
import type { ShotDelta, ShotMemory } from "./shot";
import type {
  CameraTemplateId,
  StylePresetId,
  WorldBible,
} from "./world-style-camera";

export type AspectRatio = string;

/** Prompt Composer 唯一输入 — 所有 Image / Video 模型统一走此结构 */
export type ComposeInput = {
  projectBible: ProjectBible;
  aspectRatio: AspectRatio;
  projectStyle?: string;
  stylePresetId?: StylePresetId;
  worldBible?: WorldBible;
  cameraTemplateId?: CameraTemplateId;
  characterIds: string[];
  sceneId?: string;
  propIds: string[];
  shotMemory?: ShotMemory;
  shotDelta: ShotDelta;
  shotIndex: number;
};

export type ComposeSection =
  | "project_bible"
  | "style_bible"
  | "world_bible"
  | "camera_bible"
  | "character_bible"
  | "scene_bible"
  | "prop_bible"
  | "shot_memory"
  | "shot_delta"
  | "constraints";

export type ComposeSectionBlock = {
  section: ComposeSection;
  title: string;
  lines: string[];
};

export type ComposeResult = {
  /** 展开 @引用 后的最终 Prompt */
  finalPrompt: string;
  sections: ComposeSectionBlock[];
  formula: string;
};
