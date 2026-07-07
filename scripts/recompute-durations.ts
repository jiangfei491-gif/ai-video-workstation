/**
 * 一次性修复：重跑 Duration Planner，把各异镜长写回已有分镜。
 * 起因：apply-pipeline-result 曾无条件把 duration 覆盖成 shotDurationSec(16)，
 * 抹掉了 Planner 的 [2,12]s 分配。分镜结构/beats/旁白都对，只需重算镜长，无需重跑 GPT。
 * 用法：npx tsx scripts/recompute-durations.ts           (dry-run，只打统计)
 *      npx tsx scripts/recompute-durations.ts --write    (写回 PG)
 */
import { Client } from "pg";
import { planNarrativeDuration } from "../app/lib/director/duration/plan-narrative-duration";

const WRITE = process.argv.includes("--write");

async function main() {
  const client = new Client({
    host: "localhost",
    port: 5433,
    user: "ai_cut",
    password: "ai_cut_dev",
    database: "ai_cut_v1",
  });
  await client.connect();

  const { rows } = await client.query(
    "SELECT id, ui_state FROM workbench_sessions ORDER BY updated_at DESC LIMIT 1"
  );
  const row = rows[0];
  const ui = row.ui_state;
  const wb = ui.workbench;
  const beats = (wb.narrativeBeats ?? []) as any[];
  const storyboard = (wb.director?.storyboard ?? []) as any[];
  const targetMin = Number(wb.targetDurationMinutes) || 8;
  const targetDurationSec = targetMin * 60;

  console.log(
    `读取：${storyboard.length} 镜 / ${beats.length} beats / 目标 ${targetMin}min = ${targetDurationSec}s`
  );

  const plan = planNarrativeDuration({
    targetDurationSec,
    beats: beats.map((b) => ({
      beatId: b.beatId,
      narration: b.narration,
      estimatedNarrationWeight: b.estimatedNarrationWeight,
    })),
    storyboard: storyboard.map((s) => ({
      shotId: s.shotId,
      beatId: s.beatId,
      shotPurpose: s.shotPurpose,
      narration: s.narration,
      action: s.action,
      reaction: s.reaction,
    })),
  });

  let applied = 0;
  const newSb = storyboard.map((s) => {
    const d = plan.shotDurations[s.shotId];
    if (d != null) {
      applied++;
      return { ...s, duration: d };
    }
    return s;
  });

  const durs = newSb.map((s) => Number(s.duration) || 0);
  const total = durs.reduce((a, b) => a + b, 0);
  const kinds = new Set(durs).size;
  console.log(
    `重算：应用 ${applied}/${storyboard.length} 镜 | Σ=${Math.round(total * 10) / 10}s | 镜长种类=${kinds} | min=${Math.min(...durs)} max=${Math.max(...durs)}`
  );
  console.log(`目标 ${targetDurationSec}s，drift=${(((total - targetDurationSec) / targetDurationSec) * 100).toFixed(2)}%`);
  if (plan.warnings.length) console.log("warnings:", plan.warnings.join("; "));
  console.log("前12镜镜长:", durs.slice(0, 12).join(", "));

  if (!WRITE) {
    console.log("\n[dry-run] 未写回。确认无误后加 --write。");
    await client.end();
    return;
  }

  ui.workbench.director.storyboard = newSb;
  await client.query(
    "UPDATE workbench_sessions SET ui_state = $1, updated_at = now() WHERE id = $2",
    [ui, row.id]
  );
  console.log(`\n[已写回] id=${row.id}`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
