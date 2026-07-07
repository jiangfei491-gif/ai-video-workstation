/** 只读审计：fixture rule-only，不调用 OpenAI */
import fs from "fs";
import path from "path";
import { generateNarrativeStoryboard } from "../app/lib/narrative";
import { shotsForBeat } from "../app/lib/narrative/validate-beat-split";

async function main() {
const FIXTURE = fs
  .readFileSync(path.join(__dirname, "fixtures/eight-minute-apple-script.txt"), "utf8")
  .trim();

const result = await generateNarrativeStoryboard("木村苹果", FIXTURE, {
  ruleOnly: true,
  targetDurationMinutes: 8,
  shotDurationSec: 6,
});

const { beats, narrativeShots: shots } = result;

function isWeak(s: { action: string; reaction: string }): boolean {
  const a = s.action.trim();
  const r = s.reaction.trim();
  return (
    a === "人物反应" ||
    /^人物(站着|看着|走着|停下)/.test(a) ||
    /^人物(站着|看着|走着|停下)/.test(r)
  );
}

const lines: string[] = [];
const log = (s = "") => lines.push(s);

log("=".repeat(72));
log(`一、全部 Narrative Beat（${beats.length}）`);
log("=".repeat(72));
for (const b of beats) {
  log();
  log(`--- ${b.beatId} ---`);
  log(`beatId: ${b.beatId}`);
  log(`sourceText: ${JSON.stringify(b.sourceText)}`);
  log(`beatGoal: ${b.beatGoal}`);
  log(`narrativePurpose: ${b.narrativePurpose}`);
  log(`characters: ${JSON.stringify(b.characters)}`);
  log(`environment: ${b.environment}`);
  log(`emotionalState: ${b.emotionalState}`);
  log(`informationChange: ${b.informationChange}`);
  log(`actionProcess: ${JSON.stringify(b.actionProcess ?? [])}`);
  log(`reactionProcess: ${JSON.stringify(b.reactionProcess ?? [])}`);
  log(`informationReveal: ${b.informationReveal ?? ""}`);
  log(`visualProgression: ${JSON.stringify(b.visualProgression ?? [])}`);
}

log();
log("=".repeat(72));
log(`二、全部 Narrative Shot（${shots.length}，按 Beat 分组）`);
log("=".repeat(72));
for (const b of beats) {
  const bs = shotsForBeat(shots, b.beatId);
  log();
  log(`### ${b.beatId} (${bs.length} shots)`);
  for (const s of bs) {
    log();
    log(`  shotId: ${s.shotId}`);
    log(`  beatId: ${s.beatId}`);
    log(`  character: ${s.character}`);
    log(`  action: ${s.action}`);
    log(`  reaction: ${s.reaction}`);
    log(`  environment: ${s.environment}`);
    log(`  camera: ${s.camera}`);
    log(`  visualFocus: ${s.visualFocus}`);
    log(`  shotPurpose: ${s.shotPurpose}`);
    log(`  narrationRef: ${s.narrationRef}`);
  }
}

log();
log("=".repeat(72));
log("三、事实统计");
log("=".repeat(72));
log();
log("每个 Beat 的 Shot 数量分布:");
let oneToOne = 0;
for (const b of beats) {
  const sc = shotsForBeat(shots, b.beatId).length;
  log(`  ${b.beatId} = ${sc}`);
}
log();
log("actionProcess vs shotCount:");
for (const b of beats) {
  const ap = b.actionProcess?.length ?? 0;
  const rp = b.reactionProcess?.length ?? 0;
  const ir = b.informationReveal?.trim() ? 1 : 0;
  const vp = b.visualProgression?.length ?? 0;
  const sc = shotsForBeat(shots, b.beatId).length;
  const flag = ap > 0 && ap === sc ? " [actionProcess==shotCount]" : "";
  if (ap > 0 && ap === sc) oneToOne++;
  log(
    `  ${b.beatId}: actionProcessCount=${ap}, reactionProcessCount=${rp}, informationRevealCount=${ir}, visualProgressionCount=${vp}, shotCount=${sc}${flag}`
  );
}
log();
log(`actionProcessCount == shotCount 的 Beat: ${oneToOne} / ${beats.length}`);

log();
log("=".repeat(72));
log("四、重复与机械镜头");
log("=".repeat(72));
let dupPairs = 0;
const dupList: string[] = [];
let focusPairs = 0;
const focusIds: string[] = [];
let camPairs = 0;
for (let i = 1; i < shots.length; i++) {
  const p = shots[i - 1]!;
  const c = shots[i]!;
  if (p.action.trim() === c.action.trim() || (p.action.length > 8 && c.action.includes(p.action.slice(0, 8)))) {
    dupPairs++;
    dupList.push(`${p.shotId}~${c.shotId}`);
  }
  if (p.visualFocus === c.visualFocus && p.visualFocus) {
    focusPairs++;
    focusIds.push(c.shotId);
  }
  if (p.camera === c.camera) camPairs++;
}
const weak = shots.filter(isWeak);
log(`连续相邻 action 重复/高度相似对数: ${dupPairs}`);
log(`重复对: ${dupList.join("; ") || "无"}`);
log(`连续相邻 visualFocus 相同对数: ${focusPairs}`);
log(`visualFocus 相同 shotIds: ${focusIds.join(", ") || "无"}`);
log(`连续相邻 camera 相同对数: ${camPairs}`);
log(`weakActionShotCount: ${weak.length}`);
log(`weakAction: ${weak.map((s) => `${s.shotId}(${s.action}/${s.reaction})`).join(" | ") || "无"}`);

log();
log("=".repeat(72));
log("五、Narration / 脚本污染");
log("=".repeat(72));
const scriptChars = FIXTURE.length;
const srcTotal = beats.reduce((n, b) => n + b.sourceText.length, 0);
const narrTotal = beats.reduce((n, b) => n + (b.narration?.length ?? 0), 0);
const shotNarr = shots.filter((s) => s.narration.trim()).length;
log(`原脚本字符数: ${scriptChars}`);
log(`Beat sourceText 总字符数: ${srcTotal}`);
log(`Beat narration 总字符数: ${narrTotal}`);
log(`Shot narration 非空: ${shotNarr} / ${shots.length}`);
log(`sourceText/原脚本: ${((srcTotal / scriptChars) * 100).toFixed(1)}%`);
log(`Shot 旁白扩写: ${shotNarr === 0 ? "无" : "有，需复核"}`);

const out = lines.join("\n");
console.log(out);
fs.writeFileSync(path.join(__dirname, "fixtures/narrative-audit-output.txt"), out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
