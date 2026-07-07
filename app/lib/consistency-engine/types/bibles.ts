/** Phase 1 — Project Bible：全局视觉规则，所有镜头继承 */
export type ProjectBible = {
  videoType: string;
  colorTone: string;
  cameraLanguage: string;
  lightingRules: string;
  forbidden: string;
};

export const DEFAULT_PROJECT_BIBLE: ProjectBible = {
  videoType: "",
  colorTone: "",
  cameraLanguage: "",
  lightingRules: "",
  forbidden:
    "no cartoon, no illustration, no anime, no face swap, no costume change between shots",
};

/** Character / Scene / Prop 实体存 asset-library；此处仅为 Bible 层引用 id */
export type BibleRefs = {
  characterIds: string[];
  sceneId?: string;
  propIds: string[];
};
