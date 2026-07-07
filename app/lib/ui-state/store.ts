"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { AppNavId } from "@/app/lib/nav-config";

export type HistoryTab = "video" | "image";

export type UiState = {
  currentMenu: AppNavId;
  currentHistoryTab: HistoryTab;
  /** 底部工作台动态面板 */
  activityPanelOpen: boolean;
  activityPanelHeight: number;
};

const STORAGE_KEY = "workbench:ui-state";

const defaultState: UiState = {
  currentMenu: "ai-video",
  currentHistoryTab: "video",
  activityPanelOpen: true,
  activityPanelHeight: 200,
};

let state: UiState = { ...defaultState };
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UiState>;
      if (parsed.currentMenu === ("characters" as AppNavId)) {
        parsed.currentMenu = "resources";
      }
      if (parsed.currentMenu === ("dynamic-image" as AppNavId)) {
        parsed.currentMenu = "ai-video";
      }
      state = { ...defaultState, ...parsed };
      state.activityPanelOpen = parsed.activityPanelOpen ?? defaultState.activityPanelOpen;
      state.activityPanelHeight = parsed.activityPanelHeight ?? defaultState.activityPanelHeight;
    }
  } catch {
    state = { ...defaultState };
  }
}

function emit(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function getUiState(): UiState {
  hydrate();
  return state;
}

export function patchUiState(patch: Partial<UiState>): void {
  hydrate();
  state = { ...state, ...patch };
  emit();
}

export function subscribeUiState(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUiState(): {
  state: UiState;
  patch: (p: Partial<UiState>) => void;
} {
  const snapshot = useSyncExternalStore(subscribeUiState, getUiState, () => defaultState);
  const patch = useCallback((p: Partial<UiState>) => patchUiState(p), []);
  return { state: snapshot, patch };
}
