import { spawn } from "child_process";
import { access } from "fs/promises";
import {
  getOpenCutSetupScriptPath,
  getOpenCutVendorDir,
  OPENCUT_VENDOR_EDITOR_URL,
} from "@/app/lib/opencut/vendor";

let bootPromise: Promise<void> | null = null;

export async function isVendorOpenCutReady(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(OPENCUT_VENDOR_EDITOR_URL, {
      method: "GET",
      signal: ctrl.signal,
      redirect: "follow",
      headers: { Accept: "text/html" },
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function scriptExists(): Promise<boolean> {
  try {
    await access(getOpenCutSetupScriptPath());
    return true;
  } catch {
    return false;
  }
}

/** 后台启动 vendor/opencut（clone + docker compose up） */
export function ensureVendorOpenCutStarting(): Promise<void> {
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    if (await isVendorOpenCutReady()) return;
    if (!(await scriptExists())) {
      throw new Error("缺少 scripts/opencut-zh/setup.sh");
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn("bash", [getOpenCutSetupScriptPath()], {
        cwd: process.cwd(),
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      child.on("error", reject);
      child.on("spawn", () => resolve());
    });
  })();

  return bootPromise;
}

export { getOpenCutVendorDir, OPENCUT_VENDOR_EDITOR_URL };
