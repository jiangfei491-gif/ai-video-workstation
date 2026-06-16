"use client";

import { useSyncExternalStore } from "react";
import { deleteBlobs } from "./blob-store";
import type { ExportMeta } from "@/app/lib/export/types";
import type { ImageHistoryEntry } from "./types";

const STORAGE_KEY = "workbench:history:image";
const MAX = 50;

let entries: ImageHistoryEntry[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT: ImageHistoryEntry[] = [];

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
    if (raw) entries = JSON.parse(raw) as ImageHistoryEntry[];
  } catch {
    entries = [];
  }
  sortEntriesInPlace();
}

function getSnapshot(): ImageHistoryEntry[] {
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

function collectBlobIds(e: ImageHistoryEntry): string[] {
  return [e.thumbnailBlobId, ...e.images.map((i) => i.blobId)].filter(Boolean);
}

export function getImageHistory(): ImageHistoryEntry[] {
  return getSnapshot();
}

export function appendImageHistory(entry: ImageHistoryEntry): void {
  hydrate();
  entries = [entry, ...entries].slice(0, MAX);
  sortEntriesInPlace();
  emit();
}

export async function deleteImageHistory(id: string): Promise<void> {
  hydrate();
  const entry = entries.find((e) => e.id === id);
  if (entry) await deleteBlobs(collectBlobIds(entry));
  entries = entries.filter((e) => e.id !== id);
  emit();
}

export async function clearImageHistory(): Promise<void> {
  hydrate();
  await deleteBlobs(entries.flatMap(collectBlobIds));
  entries = [];
  emit();
}

export function patchImageHistoryExport(
  id: string,
  exportMeta: ExportMeta
): void {
  hydrate();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) return;
  entries[idx] = { ...entries[idx], export: exportMeta };
  emit();
}

export function getImageHistoryById(id: string): ImageHistoryEntry | null {
  hydrate();
  return entries.find((e) => e.id === id) ?? null;
}

export function subscribeImageHistory(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useImageHistory(): ImageHistoryEntry[] {
  return useSyncExternalStore(
    subscribeImageHistory,
    getSnapshot,
    () => SERVER_SNAPSHOT
  );
}

export function searchImageHistory(opts: {
  q?: string;
  dateFrom?: string;
  dateTo?: string;
}): ImageHistoryEntry[] {
  let list = getImageHistory();
  const q = opts.q?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (e) =>
        e.topic.toLowerCase().includes(q) || e.prompt.toLowerCase().includes(q)
    );
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
