import type { SubtitleAnimationId } from "../types";

export const SUBTITLE_ANIMATION_LABEL: Record<SubtitleAnimationId, string> = {
  fade: "淡入淡出",
  typewriter: "打字机",
  "word-by-word": "逐字出现",
  karaoke: "卡拉OK",
  bounce: "弹跳",
  scale: "缩放",
  slide: "滑动",
  highlight: "关键词高亮",
  none: "无",
};

export function listAnimationPresets(): { id: SubtitleAnimationId; label: string }[] {
  return (Object.keys(SUBTITLE_ANIMATION_LABEL) as SubtitleAnimationId[]).map((id) => ({
    id,
    label: SUBTITLE_ANIMATION_LABEL[id],
  }));
}

/** 第一版：动画元数据写入 JSON，OpenCut 执行层消费 */
export function animationMeta(id: SubtitleAnimationId = "fade") {
  return { id, label: SUBTITLE_ANIMATION_LABEL[id] };
}
