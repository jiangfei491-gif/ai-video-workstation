import fs from "fs";

import { productionJsonFilePath } from "./workspace-paths";
import { getWorkspaceManager } from "@/database/workspace";

function jsonPath(name: string): string {
  return productionJsonFilePath(name);
}

export function readProductionJson<T>(name: string, fallback: T): T {
  getWorkspaceManager().ensureLayout();
  const fp = jsonPath(name);
  if (!fs.existsSync(fp)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeProductionJson(name: string, data: unknown): void {
  getWorkspaceManager().ensureLayout();
  fs.writeFileSync(jsonPath(name), JSON.stringify(data, null, 2), "utf8");
}
