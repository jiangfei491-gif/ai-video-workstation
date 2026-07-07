/**
 * Narrative Shot 第三轮审计（rule-only）
 * npx tsx scripts/audit-narrative-shots.ts
 */
import fs from "fs";
import path from "path";
import { analyzeBeatsRuleFallback } from "../app/lib/narrative/generate-narrative-storyboard";
import { generateShotsForBeat, splitNarrativeShots } from "../app/lib/narrative/generate-shots";

const FIXTURE = fs
  .readFileSync(path.join(__dirname, "fixtures/eight-minute-apple-script.txt"), "utf8")
  .trim();

const BEAT003_FOCUS_REFS = [
  "传统农业过度依赖化学药剂",
  "彻底停止使用农药",
  "邻居们嘲笑",
  "妻子也一度动摇",
];

function matchFocusRef(sourceRef: string): boolean {
  return BEAT003_FOCUS_REFS.some((k) => sourceRef.includes(k));
}

async function main() {
  const beats = analyzeBeatsRuleFallback(FIXTURE);
  const beat003 = beats.find((b) => b.beatId === "BEAT_003");
  if (!beat003) throw new Error("BEAT_003 not found");

  const lines: string[] = [];
  const log = (s = "") => lines.push(s);

  log("=".repeat(72));
  log("Narrative Shot 第三轮审计 — BEAT_003 重点（第二章：拒绝农药）");
  log("=".repeat(72));

  const { result } = await generateShotsForBeat({
    title: "木村苹果",
    beat: beat003,
    ruleOnly: true,
  });

  log(`\n### ${beat003.beatId}`);
  log(`beatGoal: ${beat003.beatGoal}`);

  const focusIntents = result.sourceIntents.filter((si) => matchFocusRef(si.sourceRef));
  for (const intent of focusIntents) {
    log(`\n--- sourceRef → sourceIntent ---`);
    log(`sourceRef: ${intent.sourceRef}`);
    log(
      `sourceIntent: ${intent.intentCode} (${intent.category}) — ${intent.description}`,
    );

    const units = result.units.filter(
      (u) =>
        u.sourceIntent === intent.intentCode ||
        u.evidenceOf === intent.sourceRef ||
        (u.evidenceOf && intent.sourceRef.includes(u.evidenceOf.slice(0, 6))),
    );
    log(`\nVisualActionUnit[] (${units.length}):`);
    for (const u of units) {
      log(`  ${u.unitId} | ${u.purpose} | subject: ${u.subject}`);
      log(`    visibleAction: ${u.visibleAction}`);
      if (u.object) log(`    object: ${u.object}`);
      if (u.location) log(`    location: ${u.location}`);
      if (u.reaction) {
        log(
          `    reaction: { subject: ${u.reaction.subject}, visibleBehavior: ${u.reaction.visibleBehavior}${u.reaction.emotionIntent ? `, emotion: ${u.reaction.emotionIntent}` : ""} }`,
        );
      }
      log(`    visualFocus: ${u.visualFocus}`);
    }

    const unitIds = new Set(units.map((u) => u.unitId));
    const shots = result.shots.filter((s) => {
      const raw = s as { sourceUnitIds?: string[] };
      return raw.sourceUnitIds?.some((id) => unitIds.has(id));
    });
    log(`\nNarrativeShot[] (${shots.length}):`);
    for (const [i, s] of shots.entries()) {
      log(`  [${i + 1}] character: ${s.character}`);
      log(`      action: ${s.action}`);
      log(`      reaction: ${s.reaction || "—"}`);
      log(`      camera: ${s.camera}`);
      log(`      visualFocus: ${s.visualFocus}`);
      log(`      shotPurpose: ${s.shotPurpose}`);
    }
  }

  log("\n" + "=".repeat(72));
  log("BEAT_003 全量 VisualActionUnit → Shot");
  log("=".repeat(72));
  for (const u of result.units) {
    log(`  ${u.unitId} | ${u.purpose} | ${u.visibleAction}`);
  }
  log(`\nNarrativeShot[] (${result.shots.length}):`);
  for (const [i, s] of result.shots.entries()) {
    log(`  [${i + 1}] ${s.character} | ${s.action} | ${s.camera}`);
  }

  const full = await splitNarrativeShots({ title: "木村苹果", beats, ruleOnly: true });
  const qa = full.shotQA;

  log("\n" + "=".repeat(72));
  log("全量 QA（9 Beat / fixture）");
  log("=".repeat(72));
  log(`visualActionUnitCount: ${qa.visualActionUnitCount}`);
  log(`shotCount: ${qa.shotCount}`);
  log(`unitToShotRatio: ${qa.unitToShotRatio.toFixed(3)}`);
  log(`oneToOneMappingRatio: ${qa.oneToOneMappingRatio.toFixed(3)}`);
  if (qa.suspiciousStrictUnitShotMapping) {
    log("⚠ SUSPICIOUS_STRICT_UNIT_SHOT_MAPPING");
  }
  log(`genericVisualActionCount: ${qa.genericVisualActionCount} (要求=0)`);
  log(`abstractReactionCount: ${qa.abstractReactionCount} (要求=0)`);
  log(`subjectMismatchCount: ${qa.subjectMismatchCount} (要求=0)`);
  log(`reactionSubjectMismatchCount: ${qa.reactionSubjectMismatchCount} (要求=0)`);
  log(`duplicateVisualUnitCount: ${qa.duplicateVisualUnitCount} (要求=0)`);
  log(`semanticLossCount: ${qa.semanticLossCount} (要求=0)`);
  log(`textCopyShotCount: ${qa.textCopyShotCount} (要求=0)`);
  log(`actionTooLongCount: ${qa.actionTooLongCount} (要求=0)`);
  log(`multiActionShotCount: ${qa.multiActionShotCount} (要求=0)`);
  log(`emptyReactionActionCount: ${qa.emptyReactionActionCount} (要求=0)`);
  log(`cameraMonotonyCount: ${qa.cameraMonotonyCount}`);
  if (qa.semanticLossIntents.length) {
    log(`semanticLossIntents: ${qa.semanticLossIntents.join("; ")}`);
  }
  if (qa.genericVisualActionIds.length) {
    log(`genericVisualActionIds: ${qa.genericVisualActionIds.join(", ")}`);
  }

  log("\n每 Beat Shot 分布:");
  for (const b of full.beats) {
    const n = full.shots.filter((s) => s.beatId === b.beatId).length;
    const u = full.units.filter((x) => x.beatId === b.beatId).length;
    log(`  ${b.beatId} = ${n} shots (${u} units)`);
  }

  const outPath = path.join(__dirname, "fixtures/narrative-shot-audit.txt");
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  console.log(lines.join("\n"));
  console.log(`\n已写入 ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
