import type { PacingProfile, TransitionType } from "./types";

export const PACING_PROFILE_LABELS: Record<PacingProfile, string> = {
  documentary: "纪录片节奏",
  viral: "爆款快剪",
  cinematic: "电影感",
};

export const TRANSITION_TYPE_LABELS: Record<TransitionType, string> = {
  cut: "硬切",
  crossfade: "交叉叠化",
  dip_black: "黑场过渡",
  slide_left: "左滑",
  slide_right: "右滑",
  slide_up: "上滑",
  slide_down: "下滑",
  zoom_in: "推近",
  blur: "模糊",
  flash: "闪白",
  wipe_left: "左擦除",
  wipe_right: "右擦除",
  push_left: "左推",
  push_right: "右推",
};

export function pacingProfileLabel(profile: string): string {
  return PACING_PROFILE_LABELS[profile as PacingProfile] ?? profile;
}

export function transitionTypeLabel(type: string): string {
  return TRANSITION_TYPE_LABELS[type as TransitionType] ?? type;
}
