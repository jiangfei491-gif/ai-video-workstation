"use client";

import { useSyncExternalStore } from "react";
import { deleteBlobs } from "./blob-store";
import type { ExportMeta } from "@/app/lib/export/types";
import type { VideoHistoryEntry } from "./types";

const STORAGE_KEY = "workbench:history:video";
const MAX = 30;

let entries: VideoHistoryEntry[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT: VideoHistoryEntry[] = [];

function sortEntriesInPlace(): void {
  entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) entries = JSON.parse(raw) as VideoHistoryEntry[];
  } catch {
    entries = [];
  }
  sortEntriesInPlace();
}

function getSnapshot(): VideoHistoryEntry[] {
  hydrate();
  return entries;
}

function emit(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function collectBlobIds(e: VideoHistoryEntry): string[] {
  const ids = [e.thumbnailBlobId];
  for (const s of e.shots) {
    if (s.veoPreviewBlobId) ids.push(s.veoPreviewBlobId);
    if (s.veoProductionBlobId) ids.push(s.veoProductionBlobId);
  }
  return ids.filter(Boolean);
}

export function getVideoHistory(): VideoHistoryEntry[] {
  return getSnapshot();
}

export function upsertVideoHistory(entry: VideoHistoryEntry): void {
  hydrate();
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) entries[idx] = entry;
  else entries = [entry, ...entries];
  entries = entries
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX);
  emit();
}

export async function deleteVideoHistory(id: string): Promise<void> {
  hydrate();
  const entry = entries.find((e) => e.id === id);
  if (entry) await deleteBlobs(collectBlobIds(entry));
  entries = entries.filter((e) => e.id !== id);
  emit();
}

export async function clearVideoHistory(): Promise<void> {
  hydrate();
  const allIds = entries.flatMap(collectBlobIds);
  await deleteBlobs(allIds);
  entries = [];
  emit();
}

export function patchVideoHistoryExport(
  id: string,
  exportMeta: ExportMeta
): void {
  hydrate();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) return;
  entries[idx] = { ...entries[idx], export: exportMeta };
  emit();
}

export function getVideoHistoryById(id: string): VideoHistoryEntry | null {
  hydrate();
  return entries.find((e) => e.id === id) ?? null;
}

export function subscribeVideoHistory(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useVideoHistory(): VideoHistoryEntry[] {
  return useSyncExternalStore(
    subscribeVideoHistory,
    getSnapshot,
    () => SERVER_SNAPSHOT
  );
}

export function useVideoHistoryActions() {
  return {
    upsert: upsertVideoHistory,
    remove: deleteVideoHistory,
    clear: clearVideoHistory,
  };
}

export function searchVideoHistory(opts: {
  q?: string;
  dateFrom?: string;
  dateTo?: string;
}): VideoHistoryEntry[] {
  let list = getVideoHistory();
  const q = opts.q?.trim().toLowerCase();
  if (q) {
    list = list.filter((e) => {
      if (e.topic.toLowerCase().includes(q)) return true;
      if (e.script.toLowerCase().includes(q)) return true;
      return e.shots.some((s) => s.providerPrompt.toLowerCase().includes(q));
    });
  }
  if (opts.dateFrom) {
    const from = new Date(opts.dateFrom).getTime();
    list = list.filter((e) => new Date(e.createdAt).getTime() >= from);
  }
  if (opts.dateTo) {
    const to = new Date(opts.dateTo).getTime() + 86400000;
    list = list.filter((e) => new Date(e.createdAt).getTime() < to);
  }
  return list;
}
