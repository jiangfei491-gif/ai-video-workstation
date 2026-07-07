import type { T2VWorkbenchState } from "./types";

const WORKBENCH_KEY = "workbench:t2v";

/** Workspace 已统一，Workbench 始终走 PostgreSQL */
export async function resolveUnifiedMode(): Promise<boolean> {
  return true;
}

export async function loadJsonFromServer<T>(_key: string): Promise<T | null> {
  try {
    const res = await fetch("/api/workbench/session", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { state?: T };
    return data.state ?? null;
  } catch {
    return null;
  }
}

export async function saveWorkbenchToServer(key: string, value: unknown): Promise<boolean> {
  if (key !== WORKBENCH_KEY) return false;
  try {
    const res = await fetch("/api/workbench/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type { T2VWorkbenchState };
