const SCRIPT_KEY = "workbench:project-script";
const SCRIPT_LABEL_KEY = "workbench:project-script-label";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

/** 长脚本单独存 sessionStorage，避免主工作台 JSON 超配额时丢失 */
export function cacheProjectScript(text: string, label?: string): void {
  if (!canUseStorage()) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  try {
    sessionStorage.setItem(SCRIPT_KEY, trimmed);
    if (label?.trim()) {
      sessionStorage.setItem(SCRIPT_LABEL_KEY, label.trim());
    }
  } catch {
    /* quota */
  }
}

export function loadCachedProjectScript(): { text: string; label?: string } | null {
  if (!canUseStorage()) return null;
  try {
    const text = sessionStorage.getItem(SCRIPT_KEY)?.trim();
    if (!text) return null;
    const label = sessionStorage.getItem(SCRIPT_LABEL_KEY)?.trim();
    return { text, label: label || undefined };
  } catch {
    return null;
  }
}

export function clearCachedProjectScript(): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem(SCRIPT_KEY);
    sessionStorage.removeItem(SCRIPT_LABEL_KEY);
  } catch {
    /* ignore */
  }
}

/** 取最长非空脚本文本 */
export function pickLongestScript(...candidates: (string | undefined | null)[]): string {
  let best = "";
  for (const c of candidates) {
    const t = c?.trim() ?? "";
    if (t.length > best.length) best = t;
  }
  return best;
}
