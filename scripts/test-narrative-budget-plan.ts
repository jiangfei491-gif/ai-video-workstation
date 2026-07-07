/**
 * Narrative Beat → Narrative Shot 层级测试
 *
 * 离线（规则链路）：
 *   npx tsx scripts/test-narrative-budget-plan.ts --rule-only --narrative-only
 *
 * 完整 GPT：
 *   npx tsx scripts/test-narrative-budget-plan.ts --script scripts/fixtures/eight-minute-apple-script.txt --narrative-only
 */
import fs from "fs";
import path from "path";
import {
  generateNarrativeStoryboard,
  analyzeMultiActionViolations,
} from "../app/lib/narrative";
import type { NarrativeBeat, NarrativeShot } from "../app/lib/narrative/types";
import { shotsForBeat } from "../app/lib/narrative/validate-beat-split";

const IMAGE_BUDGET = 45;
const TITLE = "木村苹果：一颗改变命运的果实";

function loadScript(): string {
  const argIdx = process.argv.indexOf("--script");
  if (argIdx >= 0 && process.argv[argIdx + 1]) {
    return fs.readFileSync(path.resolve(process.argv[argIdx + 1]!), "utf8").trim();
  }
  if (process.env.NARRATIVE_TEST_SCRIPT?.trim()) {
    return process.env.NARRATIVE_TEST_SCRIPT.trim();
  }
  return fs
    .readFileSync(path.join(__dirname, "fixtures/eight-minute-apple-script.txt"), "utf8")
    .trim();
}

function printBeatDetail(beat: NarrativeBeat, shots: NarrativeShot[]) {
  const beatShots = shotsForBeat(shots, beat.beatId);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`### ${beat.beatId}`);
  console.log(`sourceText:\n${beat.sourceText.slice(0, 400)}${beat.sourceText.length > 400 ? "…" : ""}`);
  console.log(`\nbeatGoal: ${beat.beatGoal}`);
  console.log(`actionProcess (${beat.actionProcess?.length ?? 0}):`);
  for (const [i, a] of (beat.actionProcess ?? []).entries()) {
    console.log(`  ${i + 1}. ${a}`);
  }
  console.log(`reactionProcess (${beat.reactionProcess?.length ?? 0}):`);
  for (const [i, r] of (beat.reactionProcess ?? []).entries()) {
    console.log(`  ${i + 1}. ${r}`);
  }
  console.log(`informationReveal: ${beat.informationReveal || "（无）"}`);
  console.log(`visualProgression:`);
  for (const [i, v] of (beat.visualProgression ?? []).entries()) {
    console.log(`  ${i + 1}. ${v}`);
  }
  console.log(`\nNarrative Shots (${beatShots.length}):`);
  for (const s of beatShots) {
    console.log(`  - ${s.shotId} | ${s.shotPurpose} | focus=${s.visualFocus}`);
    console.log(`    action: ${s.action}`);
    if (s.reaction) console.log(`    reaction: ${s.reaction}`);
  }
}

async function main() {
  const ruleOnly = process.argv.includes("--rule-only");
  const narrativeOnly = process.argv.includes("--narrative-only");
  const script = loadScript();

  console.log(`脚本字数: ${script.length}`);
  console.log(`模式: ${ruleOnly ? "rule-only" : "GPT 全链路"}\n`);

  const narrative = await generateNarrativeStoryboard(TITLE, script, {
    targetDurationMinutes: 8,
    shotDurationSec: 6,
    ruleOnly,
  });

  const { beats, narrativeShots: shots, splitDiagnostics: diag } = narrative;
  const shotCount = shots.length;
  const avgShotsPerBeat = beats.length ? (shotCount / beats.length).toFixed(2) : "0";

  console.log("=== Narrative 汇总 ===");
  console.log(`Narrative Beat 数量: ${beats.length}`);
  console.log(`Narrative Shot 数量: ${shotCount}`);
  console.log(`平均每 Beat Shot 数: ${avgShotsPerBeat}`);
  console.log(`singleShotBeatCount: ${diag.singleShotBeatCount}`);
  console.log(`underSplitBeatCount: ${diag.underSplitBeatCount}`);
  console.log(`multiActionSingleShotCount: ${diag.multiActionSingleShotCount}`);

  if (diag.underSplitBeatIds.length) {
    console.log(`underSplitBeatIds: ${diag.underSplitBeatIds.join(", ")}`);
  }

  console.log("\n=== 前 5 个 Beat 完整拆镜 ===");
  for (const beat of beats.slice(0, 5)) {
    printBeatDetail(beat, shots);
  }

  const violations = analyzeMultiActionViolations(
    shots.map((s) => ({ shotId: s.shotId, beatId: s.beatId, action: s.action }))
  );
  console.log(`\n=== 多动作 action 检测: ${violations.length} 条 ===`);
  for (const v of violations.slice(0, 10)) {
    console.log(`  [${v.shotId}] ${v.reason}: ${v.action.slice(0, 60)}`);
  }

  if (!narrativeOnly) {
    const { planImageBudget, assertImageBudgetCompliance } = await import(
      "../app/lib/image-task"
    );
    const plan = await planImageBudget({
      title: TITLE,
      beats,
      storyboard: narrative.storyboard,
      imageBudget: IMAGE_BUDGET,
      ruleOnly,
    });
    assertImageBudgetCompliance(plan.imageTasks, IMAGE_BUDGET);
    console.log(`\n=== 成本层（未修改 Planner）===`);
    console.log(`ImageTask: ${plan.imageTasks.length} / budget ${IMAGE_BUDGET}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
