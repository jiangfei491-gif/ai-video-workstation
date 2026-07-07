import { appendWorkbenchActivity, updateWorkbenchActivity } from "../store";

/** 资源中心事件桥接到全站「工作台动态」实时日志 */

export function activityCrawlStart(taskId: string, sourceName: string): string {
  return appendWorkbenchActivity({
    moduleId: "resources",
    moduleLabel: "资源中心",
    actor: "抓取器",
    status: "running",
    message: `抓取「${sourceName}」`,
    taskId,
  }).id;
}

export function activityCrawlDone(
  activityId: string,
  sourceName: string,
  itemsFound: number,
  failed: boolean,
  detail?: string
): void {
  updateWorkbenchActivity(activityId, {
    status: failed ? "failed" : "success",
    message: failed ? `抓取「${sourceName}」失败` : `抓取「${sourceName}」完成 · 发现 ${itemsFound} 项`,
    detail,
  });
}

/** AI 分析入库一条素材 */
export function activityAnalysisDone(libraryLabel: string, title: string, tags: string[], byVision: boolean): void {
  appendWorkbenchActivity({
    moduleId: "resources",
    moduleLabel: "资源中心",
    actor: byVision ? "Gemini 视觉分析" : "DeepSeek 分析",
    status: "success",
    message: `分析入库 · ${libraryLabel}：${title}`,
    detail: tags.slice(0, 5).join("、"),
  });
}
