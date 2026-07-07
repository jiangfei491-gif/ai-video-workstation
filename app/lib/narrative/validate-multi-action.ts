export type MultiActionViolation = {
  shotId: string;
  beatId: string;
  action: string;
  reason: string;
};

const CONNECTORS =
  /(?:然后|接着|随后|之后|再|并|同时|一边.+一边|，.{2,16}(?:走|拿|看|发现|露出|转|停|摘|擦|观察|震惊|进入|离开))/;

const COMMA_CHAIN = /[^，。；！？]{2,20}[，、][^，。；！？]{2,20}[，、][^，。；！？]{2,20}/;

export function detectMultiAction(action: string): { flagged: boolean; reason?: string } {
  const text = action.trim();
  if (!text) return { flagged: false };
  if (CONNECTORS.test(text)) {
    return { flagged: true, reason: "含连续动作连接词" };
  }
  if (COMMA_CHAIN.test(text)) {
    return { flagged: true, reason: "单 action 含多段逗号动作链" };
  }
  const verbs = text.match(/[\u4e00-\u9fff]{1,4}(?:了|着|过)/g);
  if (verbs && verbs.length >= 3) {
    return { flagged: true, reason: `疑似 ${verbs.length} 个连续谓语` };
  }
  return { flagged: false };
}

export function analyzeMultiActionViolations(
  shots: { shotId: string; beatId: string; action: string }[]
): MultiActionViolation[] {
  const out: MultiActionViolation[] = [];
  for (const s of shots) {
    const r = detectMultiAction(s.action);
    if (r.flagged) {
      out.push({ shotId: s.shotId, beatId: s.beatId, action: s.action, reason: r.reason ?? "多动作" });
    }
  }
  return out;
}
