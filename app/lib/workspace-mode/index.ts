import type { WorkspaceMode } from "./types";

export type { WorkspaceMode } from "./types";
export { isPreviewMode, isProductionMode } from "./types";

export function parseWorkspaceMode(raw: unknown): WorkspaceMode {
  return raw === "production" ? "production" : "preview";
}

export const WORKSPACE_MODE_LABELS: Record<WorkspaceMode, string> = {
  preview: "测试模式（仅预览，不保存）",
  production: "正式模式（保存到桌面 AI-Veo）",
};
