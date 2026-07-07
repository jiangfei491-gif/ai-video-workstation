import type { EditRenderMode } from "./types";

export type EditRenderModeOption = {
  id: EditRenderMode;
  emoji: string;
  title: string;
  description: string;
};

export const EDIT_RENDER_MODE_OPTIONS: EditRenderModeOption[] = [
  {
    id: "mixed",
    emoji: "🎬",
    title: "智能混合（推荐）",
    description: "优先使用视频，没有视频则自动使用图片动画。",
  },
  {
    id: "image",
    emoji: "🖼️",
    title: "图片故事模式",
    description: "全部使用图片，并自动添加缓慢推拉运镜效果。",
  },
  {
    id: "video",
    emoji: "🎥",
    title: "纯视频模式",
    description: "仅使用已生成的视频素材，不使用图片。",
  },
];
