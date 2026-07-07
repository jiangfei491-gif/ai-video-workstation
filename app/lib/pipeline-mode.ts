/** 创作中心管线：文生图 / 文生视频 / 图生视频 */
export type PipelineMode = "t2i" | "t2v" | "i2v";

export const PIPELINE_MODES: PipelineMode[] = ["t2i", "t2v", "i2v"];

export const PIPELINE_MODE_LABELS: Record<PipelineMode, string> = {
  t2i: "文生图",
  t2v: "文生视频",
  i2v: "图生视频",
};

export const PIPELINE_MODE_DESC: Record<PipelineMode, string> = {
  t2i: "文生图 · 按分镜直接生成镜头图片并导出",
  t2v: "文生视频 · 直接生成视频",
  i2v: "图生视频 · 先锁定首帧再生成视频",
};

export function needsFrameGen(mode: PipelineMode): boolean {
  return mode === "t2i" || mode === "i2v";
}

export function needsVideoGen(mode: PipelineMode): boolean {
  return mode === "t2v" || mode === "i2v";
}

/** 兼容旧版 image / video 取值 */
export function normalizePipelineMode(mode: unknown): PipelineMode {
  if (mode === "t2i" || mode === "t2v" || mode === "i2v") return mode;
  if (mode === "image") return "i2v";
  if (mode === "video") return "t2v";
  return "t2v";
}
