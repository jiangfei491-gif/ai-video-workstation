import type { WorkbenchActivityAppend, WorkbenchActivityEntry } from "./types";

const MAX = 600;
const buffer: WorkbenchActivityEntry[] = [];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function appendWorkbenchActivity(
  entry: WorkbenchActivityAppend
): WorkbenchActivityEntry {
  const now = new Date().toISOString();
  const row: WorkbenchActivityEntry = {
    id: entry.id ?? newId(),
    at: entry.at ?? now,
    updatedAt: entry.updatedAt ?? now,
    moduleId: entry.moduleId,
    moduleLabel: entry.moduleLabel,
    actor: entry.actor,
    status: entry.status,
    message: entry.message,
    detail: entry.detail,
    taskId: entry.taskId,
  };
  buffer.push(row);
  if (buffer.length > MAX) buffer.shift();
  return row;
}

export function updateWorkbenchActivity(
  id: string,
  patch: Partial<Pick<WorkbenchActivityEntry, "status" | "message" | "detail">>
): WorkbenchActivityEntry | null {
  const row = buffer.find((r) => r.id === id);
  if (!row) return null;
  if (patch.status != null) row.status = patch.status;
  if (patch.message != null) row.message = patch.message;
  if (patch.detail !== undefined) row.detail = patch.detail;
  row.updatedAt = new Date().toISOString();
  return row;
}

export function getWorkbenchActivities(opts?: {
  limit?: number;
  since?: string;
}): WorkbenchActivityEntry[] {
  const limit = opts?.limit ?? 120;
  let rows = buffer;
  if (opts?.since) {
    const t = Date.parse(opts.since);
    rows = buffer.filter((r) => Date.parse(r.updatedAt) > t);
  }
  return rows.slice(-limit).reverse();
}

export async function trackWorkbenchActivity<T>(
  meta: {
    moduleId: string;
    moduleLabel: string;
    actor: string;
    message: string;
    taskId?: string;
  },
  fn: () => Promise<T>
): Promise<T> {
  const row = appendWorkbenchActivity({ ...meta, status: "running" });
  try {
    const result = await fn();
    updateWorkbenchActivity(row.id, {
      status: "success",
      message: `${meta.message} · 完成`,
    });
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    updateWorkbenchActivity(row.id, {
      status: "failed",
      message: `${meta.message} · 失败`,
      detail: msg,
    });
    throw e;
  }
}
