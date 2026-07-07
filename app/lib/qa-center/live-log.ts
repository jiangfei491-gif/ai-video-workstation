import type { QaLiveLogEntry } from "./types";
import { logDirFor } from "@/app/lib/storage/workspace-paths";
import { mirrorQaLogToWorkbench } from "@/app/lib/workbench-activity/bridges/qa";

export const qaCenterLogRoot = logDirFor("qa-center");

const MAX = 500;
const buffer: QaLiveLogEntry[] = [];

export function appendQaLiveLog(
  entry: Omit<QaLiveLogEntry, "at"> & { at?: string }
): QaLiveLogEntry {
  const row: QaLiveLogEntry = {
    ...entry,
    at: entry.at ?? new Date().toISOString(),
  };
  buffer.push(row);
  if (buffer.length > MAX) buffer.shift();
  try {
    mirrorQaLogToWorkbench(row);
  } catch {
    /* ignore mirror errors */
  }
  return row;
}

export function getQaLiveLogs(opts?: { taskId?: string; limit?: number }): QaLiveLogEntry[] {
  const limit = opts?.limit ?? 80;
  let rows = buffer;
  if (opts?.taskId) {
    rows = buffer.filter((r) => r.taskId === opts.taskId);
  }
  return rows.slice(-limit);
}

export function clearQaLiveLogs(taskId?: string): void {
  if (!taskId) {
    buffer.length = 0;
    return;
  }
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (buffer[i]!.taskId === taskId) buffer.splice(i, 1);
  }
}
