import type { OutlineCandidate, ScriptProviderId } from "./types";

export type ModelOutlinePick = {
  provider: ScriptProviderId;
  outline: OutlineCandidate;
};

/** 每个模型取最高分大纲，再取总分前 2 名模型 */
export function pickTopTwoModelOutlines(outlines: OutlineCandidate[]): ModelOutlinePick[] {
  const byProvider = new Map<ScriptProviderId, OutlineCandidate>();
  for (const o of outlines) {
    const prev = byProvider.get(o.provider);
    if (!prev || (o.totalScore ?? 0) > (prev.totalScore ?? 0)) {
      byProvider.set(o.provider, o);
    }
  }

  const ranked = [...byProvider.entries()]
    .sort((a, b) => (b[1].totalScore ?? 0) - (a[1].totalScore ?? 0))
    .slice(0, 2);

  return ranked.map(([provider, outline]) => ({ provider, outline }));
}
