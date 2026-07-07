import type { BibleRefs } from "./bibles";

/** Phase 1 — 单镜变化量（用户/编导只编辑这一块） */
export type ShotDelta = {
  action: string;
  camera: string;
  lighting: string;
  /** 编导 delta Prompt 或用户补充 */
  extraPrompt?: string;
};

/** Phase 1 — 上一镜记忆（系统自动维护） */
export type ShotMemory = {
  inheritFrom: number | null;
  /** 上一镜状态摘要 */
  summary: string;
  /** 继承时应保持不变的锁定项 */
  locked: BibleRefs;
};

/** 持久化在工作台每镜 prompt 上的一致性元数据 */
export type ShotConsistencyMeta = BibleRefs & {
  inheritFrom: number | null;
  deltaAction: string;
  deltaCamera: string;
  lighting: string;
};

export const EMPTY_BIBLE_REFS: BibleRefs = {
  characterIds: [],
  propIds: [],
};

export function shotDeltaFromMeta(
  meta: Partial<ShotConsistencyMeta>,
  extraPrompt = ""
): ShotDelta {
  return {
    action: meta.deltaAction ?? "",
    camera: meta.deltaCamera ?? "",
    lighting: meta.lighting ?? "same as previous",
    extraPrompt,
  };
}

export function metaFromDelta(
  delta: ShotDelta,
  refs: BibleRefs,
  inheritFrom: number | null
): ShotConsistencyMeta {
  return {
    ...refs,
    inheritFrom,
    deltaAction: delta.action,
    deltaCamera: delta.camera,
    lighting: delta.lighting,
  };
}
