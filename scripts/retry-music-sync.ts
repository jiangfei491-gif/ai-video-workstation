/**
 * 一次性验证脚本：把 20 首 failed 的音乐种子重置为 pending，重跑一次 sync（DeepSeek）。
 * 6 首死链会在 fetch 阶段照样 404（与 provider 无关，预期内）；14 首额度问题的会真正走到 DeepSeek 调用。
 * 用法：npx tsx scripts/retry-music-sync.ts
 */
import { getOrCreateDefaultPool } from "../database/repositories/pg/pool";
import { runPublicSync } from "../app/lib/music-module/sync-service";

async function main() {
  const pool = getOrCreateDefaultPool();
  const { rows } = await pool.query<{ seed_id: string }>(
    `SELECT seed_id FROM music_seed_status WHERE status = 'failed'`
  );
  console.log(`重置 ${rows.length} 条 failed → pending`);
  for (const r of rows) {
    await pool.query(
      `UPDATE music_seed_status SET status='pending', last_error=NULL, updated_at=now() WHERE seed_id=$1`,
      [r.seed_id]
    );
  }

  console.log("跑 runPublicSync('import', undefined, {limit:20}) ...");
  const result = await runPublicSync("import", undefined, { limit: 20 });
  console.log("结果:", JSON.stringify(result, null, 2));

  const { rows: statusRows } = await pool.query<{ status: string; count: string }>(
    `SELECT status, count(*) FROM music_seed_status GROUP BY status`
  );
  console.log("最终状态分布:", statusRows);

  const { rows: errRows } = await pool.query<{ last_error: string; count: string }>(
    `SELECT last_error, count(*) FROM music_seed_status WHERE status='failed' GROUP BY last_error`
  );
  console.log("剩余失败原因:", errRows);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
