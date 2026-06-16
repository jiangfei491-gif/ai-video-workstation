"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  createDefaultExportMeta,
  migrateLegacyExportRecords,
  normalizeExportMeta,
  type ExportMeta,
  type LegacyExportRecord,
} from "@/app/lib/export/types";
import type { SeedMode } from "@/app/lib/generation-params";
import type {
  ImageAspectRatio,
  ImageClarity,
  ImageCount,
  ImageStyle,
} from "@/app/lib/image-gen/types";
import type { WorkspaceMode } from "@/app/lib/workspace-mode";
import { normalizeSeedFields } from "@/app/lib/generation-params";
import { loadJson, saveJson } from "@/app/lib/workbench-persist/storage";

export type GeneratedImage = {
  id: string;
  prompt: string;
  previewUrl: string;
  publicUrl?: string;
  blobId?: string;
  width: number;
  height: number;
  model: string;
  createdAt: string;
};

export type T2IWorkbenchState = {
  topic: string;
  prompt: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  clarity: ImageClarity;
  imageCount: ImageCount;
  seedMode: SeedMode;
  seed: number | null;
  workspaceMode: WorkspaceMode;
  voiceoverText: string;
  subtitleText: string;
  images: GeneratedImage[];
  selectedImageId: string | null;
  export: ExportMeta;
  loading: boolean;
  error: string | null;
  historyEntryId: string | null;
};

const STORAGE_KEY = "workbench:t2i";

const defaultState: T2IWorkbenchState = {
  topic: "",
  prompt: "",
  style: "realistic",
  aspectRatio: "9:16",
  clarity: "hd",
  imageCount: 1,
  seedMode: "random",
  seed: null,
  workspaceMode: "preview",
  voiceoverText: "",
  subtitleText: "",
  images: [],
  selectedImageId: null,
  export: createDefaultExportMeta(),
  loading: false,
  error: null,
  historyEntryId: null,
};

let state: T2IWorkbenchState = { ...defaultState };
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const saved = loadJson<T2IWorkbenchState>(STORAGE_KEY);
  if (saved) {
    const merged = { ...defaultState, ...saved } as typeof defaultState & {
      exportRecords?: LegacyExportRecord[];
    };
    if (!merged.export) {
      merged.export = migrateLegacyExportRecords(merged.exportRecords);
    } else {
      merged.export = normalizeExportMeta(merged.export);
    }
    delete merged.exportRecords;
    state = normalizeSeedFields(merged);
  }
}

function emit(): void {
  saveJson(STORAGE_KEY, state, { stripLargeUrls: true });
  listeners.forEach((l) => l());
}

export function getT2IState(): T2IWorkbenchState {
  hydrate();
  return state;
}

export function setT2IState(patch: Partial<T2IWorkbenchState>): void {
  hydrate();
  state = normalizeSeedFields({ ...state, ...patch });
  emit();
}

export function subscribeT2I(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useT2IWorkbenchStore(): {
  state: T2IWorkbenchState;
  patch: (p: Partial<T2IWorkbenchState>) => void;
} {
  const snapshot = useSyncExternalStore(subscribeT2I, getT2IState, () => defaultState);
  const patch = useCallback((p: Partial<T2IWorkbenchState>) => setT2IState(p), []);
  return { state: snapshot, patch };
}
