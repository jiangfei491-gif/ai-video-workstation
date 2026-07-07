import type { QaLiveLogEntry } from "@/app/lib/qa-center/types";
import { appendWorkbenchActivity } from "../store";

/** 质检自检日志同步到全局工作台动态 */
export function mirrorQaLogToWorkbench(row: QaLiveLogEntry): void {
  const status =
    row.level === "error"
      ? "failed"
      : row.level === "ok"
        ? row.stage === "complete" || row.stage === "auto-fix"
          ? "success"
          : "info"
        : row.level === "warn"
          ? "info"
          : row.stage === "init" || row.stage === "deepseek" || row.stage === "rule-engine"
            ? "running"
            : "info";

  appendWorkbenchActivity({
    id: `qa-log-${row.taskId}-${row.at}-${row.stage}`,
    moduleId: "qa-center",
    moduleLabel: "质检中心",
    actor: row.stage === "auto-fix" ? "定点自动修复" : "DeepSeek QA",
    status,
    message: row.message,
    detail: row.detail,
    taskId: row.taskId,
  });
}
