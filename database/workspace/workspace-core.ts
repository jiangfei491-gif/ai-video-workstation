import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DEFAULT_WORKSPACE_DIR_NAME } from "./paths";

/** 全局指针：重启后定位可配置的 workspaceRoot（不在 workspace 内部） */
export const GLOBAL_WORKSPACE_POINTER = path.join(
  os.homedir(),
  ".ai-video-os",
  "workspace-pointer.json"
);

interface WorkspacePointer {
  workspaceRoot: string;
  updatedAt?: string;
}

export function expandHome(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("~/")) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  if (trimmed === "~") {
    return os.homedir();
  }
  return trimmed;
}

export function resolveAbsolute(input: string): string {
  return path.resolve(expandHome(input));
}

export function defaultWorkspaceRoot(): string {
  return path.join(os.homedir(), DEFAULT_WORKSPACE_DIR_NAME);
}

export function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function readGlobalPointer(): string | null {
  const ptr = readJsonFile<WorkspacePointer>(GLOBAL_WORKSPACE_POINTER);
  return ptr?.workspaceRoot ? resolveAbsolute(ptr.workspaceRoot) : null;
}

export function writeGlobalPointer(workspaceRoot: string): void {
  fs.mkdirSync(path.dirname(GLOBAL_WORKSPACE_POINTER), { recursive: true });
  fs.writeFileSync(
    GLOBAL_WORKSPACE_POINTER,
    JSON.stringify(
      { workspaceRoot: resolveAbsolute(workspaceRoot), updatedAt: new Date().toISOString() },
      null,
      2
    ),
    "utf8"
  );
}

export function resolveWorkspaceRootFromEnv(): string | null {
  const env = process.env.AI_VIDEO_OS_ROOT ?? process.env.WORKSPACE_ROOT ?? null;
  return env ? resolveAbsolute(env) : null;
}

export function resolveInitialWorkspaceRoot(): string {
  return resolveWorkspaceRootFromEnv() ?? readGlobalPointer() ?? defaultWorkspaceRoot();
}
