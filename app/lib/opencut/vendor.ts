import {
  openCutSetupScriptPath,
  openCutVendorDir,
} from "@/app/lib/storage/workspace-paths";
import {
  OPENCUT_VENDOR_EDITOR_URL,
  OPENCUT_VENDOR_REPO,
} from "./constants";

export { OPENCUT_VENDOR_EDITOR_URL, OPENCUT_VENDOR_REPO };

export function getOpenCutVendorDir(): string {
  return openCutVendorDir();
}

export function getOpenCutSetupScriptPath(): string {
  return openCutSetupScriptPath();
}

/** @deprecated 模块加载时快照；请优先使用 getOpenCutVendorDir() */
export const OPENCUT_VENDOR_DIR = openCutVendorDir();

/** @deprecated 请优先使用 getOpenCutSetupScriptPath() */
export const OPENCUT_VENDOR_SETUP_SCRIPT = openCutSetupScriptPath();
