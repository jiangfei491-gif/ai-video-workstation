import fs from "node:fs";
import path from "node:path";

import { ensureDesktopVeoLayout, productionJsonPath, dataJsonPath } from "./paths";

export type JsonStoreScope = "production" | "data";

function resolvePath(name: string, scope: JsonStoreScope): string {
  return scope === "data" ? dataJsonPath(name) : productionJsonPath(name);
}

export function readJsonFile<T>(name: string, fallback: T, scope: JsonStoreScope = "production"): T {
  if (scope === "production") ensureDesktopVeoLayout();
  const fp = resolvePath(name, scope);
  if (!fs.existsSync(fp)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(name: string, data: unknown, scope: JsonStoreScope = "production"): void {
  if (scope === "production") ensureDesktopVeoLayout();
  const fp = resolvePath(name, scope);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf8");
}

export function readJsonArray<T>(name: string, scope: JsonStoreScope = "production"): T[] {
  return readJsonFile<T[]>(name, [], scope);
}

export function writeJsonArray<T>(name: string, items: T[], scope: JsonStoreScope = "production"): void {
  writeJsonFile(name, items, scope);
}
