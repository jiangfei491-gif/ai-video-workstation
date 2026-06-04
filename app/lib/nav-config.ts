export type AppNavId = "dynamic-image" | "ai-video" | "trends";

export const APP_NAV_ITEMS: {
  id: AppNavId;
  label: string;
  href: string;
}[] = [
  { id: "dynamic-image", label: "AI动态图片", href: "/dynamic-image" },
  { id: "ai-video", label: "AI视频", href: "/ai-video" },
  { id: "trends", label: "热点中心", href: "/trends" },
];

export const LEGACY_ROUTE_TO_NAV: Record<string, AppNavId> = {
  "/dynamic-video": "dynamic-image",
  "/image-mix": "dynamic-image",
  "/tiktok-trends": "trends",
  "/youtube-trends": "trends",
};

export function resolveActiveNavId(pathname: string): AppNavId {
  const direct = APP_NAV_ITEMS.find((item) => pathname.startsWith(item.href));
  if (direct) return direct.id;
  for (const [prefix, navId] of Object.entries(LEGACY_ROUTE_TO_NAV)) {
    if (pathname.startsWith(prefix)) return navId;
  }
  return "dynamic-image";
}
