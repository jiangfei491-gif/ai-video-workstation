/** 工作台会话模式 */
export type WorkspaceMode = "preview" | "production";

export function isPreviewMode(mode: WorkspaceMode): boolean {
  return mode === "preview";
}

export function isProductionMode(mode: WorkspaceMode): boolean {
  return mode === "production";
}
