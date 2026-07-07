import { appendWorkbenchActivity } from "../store";

/** 情报中心事件桥接到全站唯一日志窗口「工作台动态」 */

const KIND_ACTOR: Record<string, string> = {
  discover: "抓取",
  score: "AI 打分",
  enqueue: "加入审核",
  approve: "审核",
  reject: "审核",
  install: "安装",
};

export function activityIcEvent(kind: string, level: string, message: string, detail?: string): void {
  appendWorkbenchActivity({
    moduleId: "intelligence-center",
    moduleLabel: "情报中心",
    actor: KIND_ACTOR[kind] ?? "情报",
    status: level === "error" ? "failed" : "success",
    message,
    detail,
  });
}
