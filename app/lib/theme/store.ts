"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, type Theme } from "./constants";

function readTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

let theme: Theme = DEFAULT_THEME;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  theme = readTheme();
  applyTheme(theme);
}

function emit(): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

export function getTheme(): Theme {
  hydrate();
  return theme;
}

export function setTheme(next: Theme): void {
  hydrate();
  theme = next;
  emit();
}

export function subscribeTheme(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): { theme: Theme; toggle: () => void; set: (t: Theme) => void } {
  const snapshot = useSyncExternalStore(subscribeTheme, getTheme, () => DEFAULT_THEME);
  const toggle = useCallback(() => {
    setTheme(snapshot === "dark" ? "light" : "dark");
  }, [snapshot]);
  const set = useCallback((t: Theme) => setTheme(t), []);
  return { theme: snapshot, toggle, set };
}
