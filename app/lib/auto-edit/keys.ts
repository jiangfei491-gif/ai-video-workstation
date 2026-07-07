export function shotKey(index: number): string {
  return `shot-${index}`;
}

export function parseShotIndex(key: string): number | null {
  if (!key.startsWith("shot-")) return null;
  const n = Number(key.slice(5));
  return Number.isFinite(n) ? n : null;
}

export function clipLabel(index: number, action?: string): string {
  const head = (action ?? "").trim().slice(0, 24);
  return head ? `镜头 ${index + 1} · ${head}` : `镜头 ${index + 1}`;
}
