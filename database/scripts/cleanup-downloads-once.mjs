#!/usr/bin/env node
/**
 * 一次性清理：pending 排单 + completed/failed/running 下载暂存
 * 不碰 storage/library/ 与 resource_library_items
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Pool } from "pg";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://ai_cut:ai_cut_dev@localhost:5433/ai_cut_v1";

const WORKSPACE_ROOT =
  process.env.AI_VIDEO_OS_ROOT?.trim() ||
  process.env.WORKSPACE_ROOT?.trim() ||
  path.join(os.homedir(), "Desktop", "AI-Veo");

const LEDGER_FILE = path.join(WORKSPACE_ROOT, "resource-center", "judged-ledger.json");
const LIBRARY_MARKER = `${path.sep}storage${path.sep}library${path.sep}`;
const DOWNLOADS_MARKER = `${path.sep}storage${path.sep}downloads${path.sep}`;

function isSafeDownloadPath(p) {
  if (!p || typeof p !== "string") return false;
  const norm = path.normalize(p);
  if (norm.includes(LIBRARY_MARKER)) return false;
  return norm.includes(DOWNLOADS_MARKER);
}

function loadLedger() {
  if (!fs.existsSync(LEDGER_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveLedger(ledger) {
  fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true });
  const tmp = `${LEDGER_FILE}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(ledger, null, 0), "utf8");
  fs.renameSync(tmp, LEDGER_FILE);
}

function deleteDownloadFile(localPath) {
  if (!isSafeDownloadPath(localPath)) return { skipped: true, reason: "unsafe-path" };
  if (!fs.existsSync(localPath)) return { skipped: true, reason: "missing" };
  try {
    const st = fs.statSync(localPath);
    const bytes = st.size;
    fs.unlinkSync(localPath);
    // 尝试删空目录（task 目录 / source 目录）
    let dir = path.dirname(localPath);
    for (let i = 0; i < 3; i++) {
      try {
        const entries = fs.readdirSync(dir);
        if (entries.length === 0) {
          fs.rmdirSync(dir);
          dir = path.dirname(dir);
        } else break;
      } catch {
        break;
      }
    }
    return { deleted: true, bytes };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const pool = new Pool({ connectionString: DB_URL });
  const stats = {
    schedulerPaused: false,
    ledgerAdded: 0,
    filesDeleted: 0,
    bytesFreed: 0,
    fileErrors: 0,
    dbDeleted: { pending: 0, running: 0, completed: 0, failed: 0, other: 0 },
  };

  console.log("=== Downloads 清理开始 ===");
  console.log("WORKSPACE_ROOT:", WORKSPACE_ROOT);
  console.log("LEDGER_FILE:", LEDGER_FILE);

  // 1. 暂停调度器
  const sched = await pool.query(
    `UPDATE resource_scheduler_config SET paused = true, updated_at = NOW() RETURNING paused`
  );
  stats.schedulerPaused = sched.rowCount > 0;
  console.log("调度器已暂停:", stats.schedulerPaused ? "是" : "无配置行");

  // 2. 取消 running
  await pool.query(
    `UPDATE resource_download_tasks SET status = 'cancelled', updated_at = NOW() WHERE status = 'running'`
  );

  // 3. 拉取需记台账的 completed 任务
  const { rows: completedRows } = await pool.query(`
    SELECT d.id, d.source_id, d.remote_url, d.local_path, d.status,
           a.analysis_result->>'canImport' AS can_import,
           EXISTS (
             SELECT 1 FROM resource_library_items l
             WHERE l.download_task_id = d.id AND l.deleted_at IS NULL
           ) AS in_library
    FROM resource_download_tasks d
    LEFT JOIN resource_analysis_tasks a ON a.download_task_id = d.id
    WHERE d.status = 'completed'
  `);

  const ledger = loadLedger();
  const now = new Date().toISOString();
  for (const row of completedRows) {
    if (!row.source_id || !row.remote_url) continue;
    const k = `${row.source_id}::${row.remote_url}`;
    if (ledger[k]) continue;
    const ingested = row.in_library || row.can_import === "true";
    ledger[k] = {
      verdict: ingested ? "ingested" : "rejected",
      reason: ingested ? "library" : "cleanup-batch",
      at: now,
    };
    stats.ledgerAdded++;
  }
  saveLedger(ledger);
  console.log("台账新增:", stats.ledgerAdded, "总条目:", Object.keys(ledger).length);

  // 4. 删暂存文件（completed / failed / cancelled-from-running）
  const { rows: fileRows } = await pool.query(`
    SELECT id, local_path, status FROM resource_download_tasks
    WHERE status IN ('completed', 'failed', 'cancelled')
      AND local_path IS NOT NULL AND local_path != ''
  `);
  for (const row of fileRows) {
    const r = deleteDownloadFile(row.local_path);
    if (r.deleted) {
      stats.filesDeleted++;
      stats.bytesFreed += r.bytes ?? 0;
    } else if (r.error) stats.fileErrors++;
  }
  console.log(
    "文件删除:",
    stats.filesDeleted,
    "释放:",
    (stats.bytesFreed / 1024 / 1024 / 1024).toFixed(2),
    "GB",
    "错误:",
    stats.fileErrors
  );

  // 5. 删 DB 排单与任务（保留 library）
  for (const status of ["pending", "completed", "failed", "cancelled", "paused"]) {
    const r = await pool.query(
      `DELETE FROM resource_download_tasks WHERE status = $1`,
      [status]
    );
    stats.dbDeleted[status] = r.rowCount ?? 0;
  }
  const other = await pool.query(
    `DELETE FROM resource_download_tasks WHERE status NOT IN ('pending','completed','failed','cancelled','paused')`
  );
  stats.dbDeleted.other = other.rowCount ?? 0;

  const libCount = await pool.query(
    `SELECT count(*)::int AS n FROM resource_library_items WHERE deleted_at IS NULL`
  );
  const pendingLeft = await pool.query(
    `SELECT count(*)::int AS n FROM resource_download_tasks WHERE status = 'pending'`
  );

  await pool.end();

  console.log("DB 删除:", stats.dbDeleted);
  console.log("library 剩余:", libCount.rows[0].n);
  console.log("pending 剩余:", pendingLeft.rows[0].n);
  console.log("=== 清理完成 ===");
}

main().catch((e) => {
  console.error("清理失败:", e);
  process.exit(1);
});
