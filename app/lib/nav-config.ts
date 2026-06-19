export type AppNavId =
  | "ai-video"
  | "characters"
  | "dynamic-image"
  | "history"
  | "trends";

export const APP_NAV_ITEMS: {
  id: AppNavId;
  label: string;
  href: string;
}[] = [
  { id: "ai-video", label: "视频创作", href: "/ai-video" },
  { id: "characters", label: "角色库", href: "/characters" },
  { id: "dynamic-image", label: "动态图片", href: "/dynamic-image" },
  { id: "history", label: "历史记录", href: "/history" },
  { id: "trends", label: "热点中心", href: "/trends" },
];

export const LEGACY_ROUTE_TO_NAV: Record<string, AppNavId> = {
  "/dynamic-video": "ai-video",
  "/image-mix": "ai-video",
  "/video-settings": "ai-video",
  "/voice-subtitles": "ai-video",
  "/projects": "history",
  "/tiktok-trends": "trends",
  "/youtube-trends": "trends",
};

export function resolveActiveNavId(pathname: string): AppNavId {
  const direct = APP_NAV_ITEMS.find((item) => pathname.startsWith(item.href));
  if (direct) return direct.id;
  for (const [prefix, navId] of Object.entries(LEGACY_ROUTE_TO_NAV)) {
    if (pathname.startsWith(prefix)) return navId;
  }
  return "ai-video";
}
