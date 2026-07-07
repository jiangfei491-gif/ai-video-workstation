import { NextResponse } from "next/server";
import {
  ensureVendorOpenCutStarting,
  getOpenCutVendorDir,
  isVendorOpenCutReady,
  OPENCUT_VENDOR_EDITOR_URL,
} from "@/app/lib/opencut/bootstrap-server";

export async function GET() {
  const ready = await isVendorOpenCutReady();
  if (ready) {
    return NextResponse.json({
      status: "ready",
      url: OPENCUT_VENDOR_EDITOR_URL,
      vendorDir: getOpenCutVendorDir(),
    });
  }

  try {
    await ensureVendorOpenCutStarting();
    return NextResponse.json({
      status: "starting",
      url: OPENCUT_VENDOR_EDITOR_URL,
      message: "正在拉取并启动内嵌 OpenCut 中文版（首次约 5–15 分钟）",
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
