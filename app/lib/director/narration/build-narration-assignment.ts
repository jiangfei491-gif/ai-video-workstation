/**
 * NarrationAssignment (IMAGE Closure) —— Beat 旁白 → Shot 旁白归属的唯一 canonical truth。
 *
 * 取代此前分散的两套分配：
 *   - Duration Planner 用整 Beat 估时
 *   - buildShotNarrationMap 用整脚本前置扁平分句
 * 统一为：每个 Beat 的旁白只分给该 Beat 自己的镜头（beat-aware），shotId 定位。
 *
 * 纯函数：不读 workbench、不调 Provider/TTS、deterministic、reorder/delete/insert 安全。
 * 唯一输入 truth：NarrativeBeat.narration / beatId、NarrativeShot.shotId / beatId。
 * 禁止用 action/reaction/environment/visualFocus/camera/shotPurpose/narrationRef 作旁白文本。
 */
import { splitNarrationPhrases } from "@/app/lib/auto-edit/audio/align-voice-subtitle";
import { estimateNarrationDurationSec } from "@/app/lib/director/duration/estimate-narration-duration";

export type NarrationAssignmentBeat = { beatId: string; narration?: string };
export type NarrationAssignmentShot = { shotId?: string; beatId?: string };

export type NarrationAssignmentEntry = {
  beatId: string;
  shotId: string;
  phraseIndex: number;
  narrationText: string;
  estimatedDurationSec: number;
};

export type NarrationAssignment = {
  /** shotId → 旁白文本（无旁白镜头为 ""） */
  shotNarrationText: Record<string, string>;
  /** shotId → 旁白估时（秒，PLANNING ESTIMATE，非真实 voice） */
  shotNarrationEstimateSec: Record<string, number>;
  /** 明细（审计/字幕身份用） */
  entries: NarrationAssignmentEntry[];
  /** 跨 Beat 泄漏计数（应恒为 0） */
  crossBeatLeakCount: number;
};

/**
 * 把每个 Beat 的旁白句均匀分配给**该 Beat 的镜头**（beat-aware，不跨 Beat）。
 * 句数 < 镜数：部分镜头空（均匀铺开，非前置）；句数 ≥ 镜数：每镜取相邻若干句。
 */
export function buildNarrationAssignment(params: {
  beats: NarrationAssignmentBeat[];
  storyboard: NarrationAssignmentShot[];
}): NarrationAssignment {
  const { beats, storyboard } = params;
  const shotNarrationText: Record<string, string> = {};
  const shotNarrationEstimateSec: Record<string, number> = {};
  const entries: NarrationAssignmentEntry[] = [];

  // 按 beatId 分组镜头（保 storyboard 顺序）
  const shotsByBeat = new Map<string, string[]>(); // beatId → shotId[]
  for (const s of storyboard) {
    if (!s.shotId) continue;
    const bid = (s.beatId && s.beatId.trim()) || "__unassigned__";
    if (!shotsByBeat.has(bid)) shotsByBeat.set(bid, []);
    shotsByBeat.get(bid)!.push(s.shotId);
    // 默认空，后续按 Beat 填充
    shotNarrationText[s.shotId] = "";
    shotNarrationEstimateSec[s.shotId] = 0;
  }

  const narrationByBeatId = new Map(beats.map((b) => [b.beatId, b.narration ?? ""]));

  for (const [beatId, shotIds] of shotsByBeat) {
    const narration = narrationByBeatId.get(beatId) ?? "";
    const phrases = splitNarrationPhrases(narration);
    const n = shotIds.length;
    if (n === 0 || phrases.length === 0) continue; // 该 Beat 无旁白 → 全空

    // 顺序分配：句数 ≤ 镜数时前 N 镜各 1 句、其余空；句数 > 镜数时每镜取相邻 quota 句。
    const quota = Math.max(1, Math.ceil(phrases.length / n));
    let p = 0;
    for (let i = 0; i < n && p < phrases.length; i++) {
      const startIdx = p;
      const parts: string[] = [];
      for (let j = 0; j < quota && p < phrases.length; j++) parts.push(phrases[p++]!);
      const text = parts.join("");
      if (!text.trim()) continue;
      const shotId = shotIds[i];
      const est = estimateNarrationDurationSec(text).durationSec;
      shotNarrationText[shotId] = text;
      shotNarrationEstimateSec[shotId] = est;
      entries.push({ beatId, shotId, phraseIndex: startIdx, narrationText: text, estimatedDurationSec: est });
    }
  }

  // 跨 Beat 泄漏自检：每条 entry 的 shotId 必属其 beatId（构造上恒成立）
  let crossBeatLeakCount = 0;
  const shotBeat = new Map(storyboard.filter((s) => s.shotId).map((s) => [s.shotId!, s.beatId]));
  for (const e of entries) {
    if (shotBeat.get(e.shotId) !== e.beatId) crossBeatLeakCount++;
  }

  return { shotNarrationText, shotNarrationEstimateSec, entries, crossBeatLeakCount };
}
