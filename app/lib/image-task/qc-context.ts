/** Score / Visual QC 共用的 ImageTask 上下文 */
export type ImageTaskQCContext = {
  primaryShotId: string;
  supportingShotIds: string[];
  actionCoverage: string[];
  visualFocus: string[];
  cameraIntent: string;
};

export function imageTaskToQcContext(
  task: {
    primaryShotId: string;
    supportingShotIds: string[];
    actionCoverage: string[];
    visualFocus: string[];
    cameraIntent: string;
  }
): ImageTaskQCContext {
  return {
    primaryShotId: task.primaryShotId,
    supportingShotIds: task.supportingShotIds,
    actionCoverage: task.actionCoverage,
    visualFocus: task.visualFocus,
    cameraIntent: task.cameraIntent,
  };
}
