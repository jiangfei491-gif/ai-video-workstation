import fs from "fs";
import path from "path";
import { DESKTOP_VEO_DIRS, ensureDesktopVeoLayout } from "./desktop-veo";

function jsonPath(name: string): string {
  return path.join(DESKTOP_VEO_DIRS.projects, name);
}

export function readProductionJson<T>(name: string, fallback: T): T {
  ensureDesktopVeoLayout();
  const fp = jsonPath(name);
  if (!fs.existsSync(fp)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeProductionJson(name: string, data: unknown): void {
  ensureDesktopVeoLayout();
  fs.writeFileSync(jsonPath(name), JSON.stringify(data, null, 2), "utf8");
}
