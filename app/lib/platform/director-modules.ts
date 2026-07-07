import {
  DIRECTOR_OVERALL_LEAD,
  PLATFORM_MODULES,
  type ModuleId,
  type PlatformModule,
} from "./module-registry";

/** 各模块入口（与侧边栏一致） */
export const MODULE_HREF: Partial<Record<ModuleId, string>> = {
  "ai-director": "/ai-director",
  "material-center": "/materials",
  "video-creation-script": "/ai-video",
  "video-creation-media": "/ai-video",
  "voice-center": "/voice-center",
  "subtitle-center": "/subtitle-center",
  "music-center": "/music-center",
  "effect-center": "/effect-center",
  "clip-agent": "/ai-edit",
  opencut: "/ai-edit",
  "qa-center": "/qa-center",
};

/** AI 导演总负责人（overallLead）管辖的模块 */
export function getDirectorManagedModules(): PlatformModule[] {
  return PLATFORM_MODULES.filter((m) => m.overallLead === DIRECTOR_OVERALL_LEAD);
}

/** 不由 AI 导演总负责的模块（执行/验收层） */
export function getDirectorAdjacentModules(): PlatformModule[] {
  return PLATFORM_MODULES.filter((m) => m.overallLead !== DIRECTOR_OVERALL_LEAD);
}

export function getModuleHref(moduleId: ModuleId): string | undefined {
  return MODULE_HREF[moduleId];
}

export type DirectorModuleRole = "decision" | "orchestrate" | "execute";

/** 导演与各模块的关系（展示用） */
export const DIRECTOR_MODULE_ROLE: Partial<Record<ModuleId, DirectorModuleRole>> = {
  "ai-director": "decision",
  "material-center": "orchestrate",
  "video-creation-script": "decision",
  "video-creation-media": "orchestrate",
  "voice-center": "orchestrate",
  "subtitle-center": "orchestrate",
  "music-center": "orchestrate",
  "effect-center": "orchestrate",
  "clip-agent": "execute",
  opencut: "execute",
  "qa-center": "execute",
};

export const DIRECTOR_MODULE_ROLE_LABEL: Record<DirectorModuleRole, string> = {
  decision: "导演决策",
  orchestrate: "导演编排",
  execute: "独立执行",
};
