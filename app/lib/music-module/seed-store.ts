/**
 * 粘贴导入曲目的入库队列状态
 */
import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import { getOrCreateDefaultPool, type IPgPool } from "@/database/repositories/pg/pool";
import { dedupeKey } from "./dedupe";
import { listImportedSeeds } from "./imported-seeds";
import type { MusicSeedTrack, SeedProgress } from "./types";

export type SeedStatus = "pending" | "ingested" | "failed" | "rejected" | "skipped";

function pool(): IPgPool {
  return getOrCreateDefaultPool();
}
function ws(id?: string): string {
  return id ?? DEFAULT_WORKSPACE_ID;
}

export async function getSeedProgress(workspaceId?: string): Promise<SeedProgress> {
  const catalog = await listImportedSeeds(workspaceId);
  const total = catalog.length;
  const { rows } = await pool().query<{ seed_id: string; status: string }>(
    `SELECT seed_id, status FROM music_seed_status WHERE workspace_id = $1`,
    [ws(workspaceId)]
  );
  const map = new Map(rows.map((r) => [r.seed_id, r.status as SeedStatus]));
  const counts: SeedProgress = {
    total,
    pending: 0,
    ingested: 0,
    failed: 0,
    rejected: 0,
    skipped: 0,
  };
  for (const seed of catalog) {
    const st = map.get(seed.id) ?? "pending";
    if (st === "pending") counts.pending++;
    else if (st === "ingested") counts.ingested++;
    else if (st === "failed") counts.failed++;
    else if (st === "rejected") counts.rejected++;
    else if (st === "skipped") counts.skipped++;
  }
  return counts;
}

export async function reconcileSeedStatus(workspaceId?: string): Promise<void> {
  const id = ws(workspaceId);
  const catalog = await listImportedSeeds(workspaceId);
  for (const seed of catalog) {
    const key = dedupeKey(seed.title, seed.author);
    const exists = await pool().queryOne<{ id: string }>(
      `SELECT id FROM music_public_lyrics WHERE workspace_id = $1 AND dedupe_key = $2 LIMIT 1`,
      [id, key]
    );
    if (exists) {
      await upsertSeedStatus(seed.id, "ingested", id, { lyricId: exists.id });
    }
  }
}

export async function listPendingSeeds(
  opts: { limit?: number; workspaceId?: string } = {}
): Promise<MusicSeedTrack[]> {
  const limit = Math.max(1, opts.limit ?? 30);
  const catalog = await listImportedSeeds(opts.workspaceId);
  const { rows } = await pool().query<{ seed_id: string; status: string }>(
    `SELECT seed_id, status FROM music_seed_status WHERE workspace_id = $1`,
    [ws(opts.workspaceId)]
  );
  const skip = new Set(
    rows
      .filter((r) => ["ingested", "failed", "rejected", "skipped"].includes(r.status))
      .map((r) => r.seed_id)
  );
  return catalog
    .filter((s) => !skip.has(s.id))
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export async function upsertSeedStatus(
  seedId: string,
  status: SeedStatus,
  workspaceId?: string,
  opts?: { error?: string; lyricId?: string; incrementAttempt?: boolean }
): Promise<void> {
  const id = ws(workspaceId);
  await pool().query(
    `INSERT INTO music_seed_status (workspace_id, seed_id, status, attempts, last_error, lyric_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (workspace_id, seed_id) DO UPDATE SET
       status = EXCLUDED.status,
       attempts = music_seed_status.attempts + CASE WHEN $7 THEN 1 ELSE 0 END,
       last_error = EXCLUDED.last_error,
       lyric_id = COALESCE(EXCLUDED.lyric_id, music_seed_status.lyric_id),
       updated_at = NOW()`,
    [
      id,
      seedId,
      status,
      opts?.incrementAttempt ? 1 : 0,
      opts?.error ?? null,
      opts?.lyricId ?? null,
      Boolean(opts?.incrementAttempt),
    ]
  );
}
