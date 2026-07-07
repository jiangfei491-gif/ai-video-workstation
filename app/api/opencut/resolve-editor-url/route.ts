import { NextResponse } from "next/server";
import {
  isVendorOpenCutReady,
  OPENCUT_VENDOR_EDITOR_URL,
} from "@/app/lib/opencut/bootstrap-server";
import {
  applyOpenCutLocaleToUrl,
  resolveOpenCutEditorUrl,
} from "@/app/lib/opencut/config";

export type OpenCutEditorSource = "env" | "vendor";

export type OpenCutEditorResolveResult = {
  url: string;
  locale: "zh" | "en";
  source: OpenCutEditorSource;
};

export async function GET() {
  const explicit = process.env.NEXT_PUBLIC_OPENCUT_EDITOR_URL?.trim();
  if (explicit) {
    const url = resolveOpenCutEditorUrl(explicit);
    return NextResponse.json({
      url,
      locale: url.includes("opencut.app") ? "en" : "zh",
      source: "env",
    } satisfies OpenCutEditorResolveResult);
  }

  if (await isVendorOpenCutReady()) {
    return NextResponse.json({
      url: OPENCUT_VENDOR_EDITOR_URL,
      locale: "zh",
      source: "vendor",
    } satisfies OpenCutEditorResolveResult);
  }

  const proxied = process.env.OPENCUT_PROXY_TARGET?.trim();
  if (proxied) {
    return NextResponse.json({
      url: applyOpenCutLocaleToUrl("/opencut-proxy/projects"),
      locale: "zh",
      source: "env",
    } satisfies OpenCutEditorResolveResult);
  }

  // 不回落官方英文版，等待内嵌副本启动
  return NextResponse.json({
    url: OPENCUT_VENDOR_EDITOR_URL,
    locale: "zh",
    source: "vendor",
  } satisfies OpenCutEditorResolveResult);
}
