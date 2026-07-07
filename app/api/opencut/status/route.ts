import { NextResponse } from "next/server";
import { isVendorOpenCutReady } from "@/app/lib/opencut/bootstrap-server";

export type OpenCutStatus = {
  /** 内嵌 OpenCut 是否可用；不可用时高级编辑回退到中文剪辑台 */
  ready: boolean;
  mode: "opencut" | "nle";
};

export async function GET() {
  const explicit = process.env.NEXT_PUBLIC_OPENCUT_EDITOR_URL?.trim();
  if (explicit) {
    return NextResponse.json({ ready: true, mode: "opencut" } satisfies OpenCutStatus);
  }

  const ready = await isVendorOpenCutReady();
  return NextResponse.json({
    ready,
    mode: ready ? "opencut" : "nle",
  } satisfies OpenCutStatus);
}
