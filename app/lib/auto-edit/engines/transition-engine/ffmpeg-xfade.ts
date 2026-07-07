import type { TransitionType } from "../../types";
import type { ExtendedTransitionType } from "../types";

/** FFmpeg xfade 转场名映射 */
export function toXfadeTransition(type: TransitionType | ExtendedTransitionType): string {
  switch (type) {
    case "crossfade":
      return "dissolve";
    case "dip_black":
      return "fadeblack";
    case "slide_left":
      return "slideleft";
    case "slide_right":
      return "slideright";
    case "slide_up":
      return "slideup";
    case "slide_down":
      return "slidedown";
    case "zoom_in":
      return "zoomin";
    case "blur":
      return "hblur";
    case "flash":
      return "fadewhite";
    case "wipe_left":
      return "wipeleft";
    case "wipe_right":
      return "wiperight";
    case "push_left":
      return "squeezeh";
    case "push_right":
      return "slideright";
    case "cut":
    default:
      return "fade";
  }
}

export const TRANSITION_ENGINE_OPTIONS: {
  id: ExtendedTransitionType;
  label: string;
  implemented: boolean;
}[] = [
  { id: "cut", label: "硬切 Concat", implemented: true },
  { id: "crossfade", label: "交叉叠化", implemented: true },
  { id: "dip_black", label: "黑场过渡", implemented: true },
  { id: "slide_left", label: "左滑", implemented: true },
  { id: "slide_right", label: "右滑", implemented: true },
  { id: "slide_up", label: "上滑", implemented: true },
  { id: "slide_down", label: "下滑", implemented: true },
  { id: "zoom_in", label: "推近", implemented: true },
  { id: "blur", label: "模糊", implemented: true },
  { id: "flash", label: "闪白", implemented: true },
  { id: "wipe_left", label: "左擦除", implemented: true },
  { id: "wipe_right", label: "右擦除", implemented: true },
  { id: "push_left", label: "左推", implemented: true },
  { id: "push_right", label: "右推", implemented: true },
];
