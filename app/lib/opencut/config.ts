import {
  OPENCUT_VENDOR_EDITOR_URL,
} from "./constants";

/** OpenCut Web 编辑器入口（官方线上，仅作备用） */
export const OPENCUT_PROJECTS_URL = "https://opencut.app/projects";

/** 社区汉化版公共镜像（可用时优先于官方英文版） */
export const OPENCUT_ZH_MIRROR_URL = "https://v.sparkbazaar.cn/projects";

/** @deprecated /editor 在官方站会 404，勿用 */
export const OPENCUT_EDITOR_INDEX_URL = "https://opencut.app/editor";

/** i18n 版 OpenCut 支持的语言前缀 */
export const OPENCUT_LOCALES = ["en", "zh", "ja", "ko"] as const;
export type OpenCutLocale = (typeof OPENCUT_LOCALES)[number];

/** 界面语言偏好，默认中文（需同源代理 + i18n 版 OpenCut 才生效） */
export const OPENCUT_UI_LOCALE: OpenCutLocale =
  (process.env.NEXT_PUBLIC_OPENCUT_LOCALE?.trim() as OpenCutLocale | undefined) ||
  "zh";

function normalizeProxiedProjectsPath(path: string): string {
  if (path.endsWith("/opencut-proxy/editor") || path.endsWith("/editor")) {
    return "/opencut-proxy/projects";
  }
  return path;
}

/** 为同源代理路径注入 locale 前缀，例如 /opencut-proxy/zh/projects */
export function applyOpenCutLocaleToUrl(url: string, locale = OPENCUT_UI_LOCALE): string {
  if (!url.startsWith("/opencut-proxy")) return url;

  const normalized = normalizeProxiedProjectsPath(url);
  const rest = normalized.replace(/^\/opencut-proxy\/?/, "");
  const [first, ...tail] = rest.split("/").filter(Boolean);

  if (first && OPENCUT_LOCALES.includes(first as OpenCutLocale)) {
    return `/opencut-proxy/${[first, ...tail].join("/")}`;
  }

  if (locale && locale !== "en") {
    return `/opencut-proxy/${locale}/${rest}`.replace(/\/+$/, "") || `/opencut-proxy/${locale}/projects`;
  }

  return normalized;
}

/**
 * 解析高级编辑 iframe 地址。
 * 默认：内嵌 vendor/opencut 中文版（http://127.0.0.1:3100/projects）
 */
export function resolveOpenCutEditorUrl(override?: string): string {
  const raw =
    override?.trim() ||
    process.env.NEXT_PUBLIC_OPENCUT_EDITOR_URL?.trim() ||
    OPENCUT_VENDOR_EDITOR_URL;

  if (
    raw === OPENCUT_EDITOR_INDEX_URL ||
    raw === `${OPENCUT_EDITOR_INDEX_URL}/`
  ) {
    return OPENCUT_PROJECTS_URL;
  }

  if (raw.startsWith("/opencut-proxy")) {
    return applyOpenCutLocaleToUrl(raw);
  }

  return raw;
}
