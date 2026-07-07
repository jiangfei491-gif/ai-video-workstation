import { DEFAULT_PROJECT_BIBLE } from "@/app/lib/consistency-engine/types/bibles";
import {
  DEFAULT_WORLD_BIBLE,
  type CameraTemplateId,
  type StylePresetId,
  type WorldBible,
} from "@/app/lib/consistency-engine/types/world-style-camera";
import type { ProjectBible } from "@/app/lib/consistency-engine/types/bibles";

/** AI 推断的全局视觉设定（客户端 / 服务端共用） */
export type InferredVisualSettings = {
  projectBible: ProjectBible;
  projectStyle: string;
  stylePresetId: StylePresetId;
  worldBible: WorldBible;
  cameraTemplateId: CameraTemplateId;
};

/** 工作台仍为默认空值时，可自动推断 */
export function isDefaultVisualSettings(input: {
  projectBible?: ProjectBible;
  stylePresetId?: StylePresetId;
  worldBible?: WorldBible;
  projectStyle?: string;
}): boolean {
  const b = input.projectBible ?? DEFAULT_PROJECT_BIBLE;
  const w = input.worldBible ?? DEFAULT_WORLD_BIBLE;
  const bibleEmpty =
    !b.videoType && !b.colorTone && !b.cameraLanguage && !b.lightingRules;
  const worldEmpty =
    !w.era && !w.country && !w.city && !w.architecture && !w.transport;
  return (
    bibleEmpty &&
    worldEmpty &&
    (input.stylePresetId ?? "custom") === "custom" &&
    !input.projectStyle?.trim()
  );
}
