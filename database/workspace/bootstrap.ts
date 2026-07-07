import type { WorkspaceManager } from "./workspace-manager";

/**
 * 首次启动 / 单例创建时自动初始化与检查。
 * 不迁移、不删除 Legacy 数据。
 */
export function bootstrapWorkspace(ws: WorkspaceManager): void {
  const settings = ws.getSettings();

  if (settings.autoInitOnStartup) {
    ws.ensureLayout();
  }

  if (settings.autoRepairMissingDirs) {
    ws.checkAndRepair();
  }

  if (settings.autoBackupEnabled && settings.autoBackupIntervalHours > 0) {
    const last = settings.lastBackupAt ? Date.parse(settings.lastBackupAt) : 0;
    const intervalMs = settings.autoBackupIntervalHours * 3600_000;
    if (Date.now() - last >= intervalMs) {
      void ws.createBackup({ type: "full", incremental: false }).then((r) => {
        if (r.success) {
          ws.updateSettings({ lastBackupAt: new Date().toISOString() });
        }
      });
    }
  }
}
