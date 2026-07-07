export type AppNavId =
  | "ai-director"
  | "ai-video"
  | "ai-edit"
  | "canvas"
  | "materials"
  | "voice-center"
  | "subtitle-center"
  | "music-center"
  | "effect-center"
  | "qa-center"
  | "resources"
  | "intelligence-center"
  | "cost"
  | "history"
  | "trends";

export const APP_NAV_ITEMS: {
  id: AppNavId;
  label: string;
  href: string;
}[] = [
  { id: "materials", label: "内容中心", href: "/materials" },
  { id: "ai-director", label: "AI 导演", href: "/ai-director" },
  { id: "voice-center", label: "配音中心", href: "/voice-center" },
  { id: "subtitle-center", label: "字幕中心", href: "/subtitle-center" },
  { id: "music-center", label: "音乐中心", href: "/music-center" },
  { id: "effect-center", label: "特效中心", href: "/effect-center" },
  { id: "qa-center", label: "质检中心", href: "/qa-center" },
  { id: "ai-video", label: "创作中心", href: "/ai-video" },
  { id: "ai-edit", label: "AI剪辑", href: "/ai-edit" },
  { id: "canvas", label: "无限画布", href: "/canvas" },
  { id: "resources", label: "资源中心", href: "/resources" },
  { id: "intelligence-center", label: "AI 情报中心", href: "/intelligence-center" },
  { id: "cost", label: "成本中心", href: "/cost" },
  { id: "history", label: "历史记录", href: "/history" },
  { id: "trends", label: "热点中心", href: "/trends" },
];

export const LEGACY_ROUTE_TO_NAV: Record<string, AppNavId> = {
  "/characters": "resources",
  "/dynamic-image": "ai-video",
  "/dynamic-video": "ai-video",
  "/image-mix": "ai-video",
  "/video-settings": "ai-video",
  "/voice-subtitles": "voice-center",
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
