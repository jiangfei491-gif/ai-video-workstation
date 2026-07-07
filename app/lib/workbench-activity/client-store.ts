"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { WorkbenchActivityAppend, WorkbenchActivityEntry } from "./types";

const POLL_MS = 2000;
const POLL_BACKOFF_MS = 15000;
const MAX_LOCAL = 400;

let entries: WorkbenchActivityEntry[] = [];
const EMPTY_SERVER_SNAPSHOT: WorkbenchActivityEntry[] = [];
const listeners = new Set<() => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollStarted = false;
let pollIntervalMs = POLL_MS;

function emit(): void {
  listeners.forEach((l) => l());
}

function mergeEntries(incoming: WorkbenchActivityEntry[]): void {
  if (incoming.length === 0) return;
  const byId = new Map(entries.map((e) => [e.id, e]));
  for (const row of incoming) {
    byId.set(row.id, row);
  }
  entries = [...byId.values()]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_LOCAL);
  emit();
}

export function getWorkbenchActivitySnapshot(): WorkbenchActivityEntry[] {
  return entries;
}

export function appendClientWorkbenchActivity(
  entry: WorkbenchActivityAppend
): WorkbenchActivityEntry {
  const now = new Date().toISOString();
  const row: WorkbenchActivityEntry = {
    id: entry.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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
  mergeEntries([row]);
  return row;
}

export function patchClientWorkbenchActivity(
  id: string,
  patch: Partial<Pick<WorkbenchActivityEntry, "status" | "message" | "detail">>
): void {
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return;
  const prev = entries[idx]!;
  entries = [
    ...entries.slice(0, idx),
    {
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString(),
    },
    ...entries.slice(idx + 1),
  ];
  emit();
}

async function pollServerActivities(fetchImpl: typeof fetch): Promise<void> {
  try {
    const res = await fetchImpl("/api/workbench/activity?limit=120", { cache: "no-store" });
    if (!res.ok) {
      if (pollIntervalMs !== POLL_BACKOFF_MS) {
        pollIntervalMs = POLL_BACKOFF_MS;
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(() => void pollServerActivities(fetchImpl), pollIntervalMs);
      }
      return;
    }
    if (pollIntervalMs !== POLL_MS) {
      pollIntervalMs = POLL_MS;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => void pollServerActivities(fetchImpl), pollIntervalMs);
    }
    const data = (await res.json()) as { activities?: WorkbenchActivityEntry[] };
    if (data.activities?.length) mergeEntries(data.activities);
  } catch {
    /* ignore poll errors */
  }
}

export function startWorkbenchActivityPolling(fetchImpl: typeof fetch = fetch): void {
  if (pollStarted || typeof window === "undefined") return;
  pollStarted = true;
  void pollServerActivities(fetchImpl);
  pollTimer = setInterval(() => void pollServerActivities(fetchImpl), pollIntervalMs);
}

export function stopWorkbenchActivityPolling(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  pollStarted = false;
}

export function subscribeWorkbenchActivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getServerWorkbenchActivitySnapshot(): WorkbenchActivityEntry[] {
  return EMPTY_SERVER_SNAPSHOT;
}

export function useWorkbenchActivity(): WorkbenchActivityEntry[] {
  return useSyncExternalStore(
    subscribeWorkbenchActivity,
    getWorkbenchActivitySnapshot,
    getServerWorkbenchActivitySnapshot
  );
}

export function countRunningActivities(list: WorkbenchActivityEntry[]): number {
  return list.filter((e) => e.status === "running").length;
}

export function useWorkbenchActivityActions() {
  const append = useCallback(appendClientWorkbenchActivity, []);
  const patch = useCallback(patchClientWorkbenchActivity, []);
  return { append, patch };
}
