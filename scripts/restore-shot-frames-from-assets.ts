/**
 * 从 image-assets.json 按 prompt 恢复编导清空后的 shotFrames 映射。
 * 用法：npx tsx scripts/restore-shot-frames-from-assets.ts           (dry-run)
 *      npx tsx scripts/restore-shot-frames-from-assets.ts --write   (写回 PG)
 */
import { Client } from "pg";

import { restoreShotFramesFromImageAssets } from "../app/lib/image-task/restore-frames-from-assets";
import type { T2VWorkbenchState } from "../app/lib/workbench-persist/types";

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
  if (!row) {
    console.log("无 workbench_sessions 记录");
    await client.end();
    return;
  }

  const ui = row.ui_state as { workbench?: T2VWorkbenchState };
  const wb = ui.workbench;
  if (!wb?.director?.prompts?.length) {
    console.log("工作台无编导分镜，无法恢复");
    await client.end();
    return;
  }

  const before = Object.keys(wb.shotFrames ?? {}).length;
  const { patch, matched, matchedByPrompt, matchedByOrder, unmatched, totalShots } =
    restoreShotFramesFromImageAssets(wb);

  console.log(
    `镜数 ${totalShots} · 恢复前 shotFrames ${before} · 匹配 ${matched}（prompt ${matchedByPrompt} / 顺序 ${matchedByOrder}）· 未匹配 ${unmatched}`
  );

  if (!WRITE) {
    console.log("dry-run，加 --write 写回数据库");
    await client.end();
    return;
  }

  const next: T2VWorkbenchState = { ...wb, ...patch };
  const payload = JSON.stringify({ workbench: next });
  await client.query(
    "UPDATE workbench_sessions SET ui_state = $2::jsonb, sync_version = sync_version + 1, updated_at = NOW() WHERE id = $1",
    [row.id, payload]
  );
  console.log(`已写回 · shotFrames ${Object.keys(next.shotFrames ?? {}).length} 条`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
