import { randomUUID } from "crypto";
import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import { getOrCreateDefaultPool, type IPgPool } from "@/database/repositories/pg/pool";
import type { MusicSeedTrack } from "./types";

function pool(): IPgPool {
  return getOrCreateDefaultPool();
}
function ws(id?: string): string {
  return id ?? DEFAULT_WORKSPACE_ID;
}

function mapRow(r: Record<string, unknown>): MusicSeedTrack {
  return {
    id: String(r.seed_id),
    title: String(r.title),
    author: String(r.author ?? ""),
    category: String(r.category ?? "其它") as MusicSeedTrack["category"],
    styleTags: Array.isArray(r.style_tags) ? (r.style_tags as string[]) : [],
    language: String(r.language ?? "en"),
    deathYear: r.death_year != null ? Number(r.death_year) : undefined,
    sourceUrl: String(r.source_url ?? ""),
    sourceType: String(r.source_type ?? "wikipedia") as MusicSeedTrack["sourceType"],
    priority: Number(r.priority ?? 5),
    note: String(r.note ?? ""),
  };
}

export async function listImportedSeeds(workspaceId?: string): Promise<MusicSeedTrack[]> {
  const { rows } = await pool().query(
    `SELECT * FROM music_imported_seeds WHERE workspace_id = $1 ORDER BY priority DESC, created_at DESC`,
    [ws(workspaceId)]
  );
  return rows.map((r) => mapRow(r as Record<string, unknown>));
}

export type SaveImportResult = {
  batchId: string;
  added: number;
  updated: number;
  skipped: number;
};

export async function saveImportedSeeds(
  tracks: MusicSeedTrack[],
  workspaceId?: string
): Promise<SaveImportResult> {
  const batchId = randomUUID();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const t of tracks) {
    if (!t.title.trim()) {
      skipped++;
      continue;
    }
    const existing = await pool().queryOne<{ seed_id: string }>(
      `SELECT seed_id FROM music_imported_seeds WHERE workspace_id = $1 AND seed_id = $2`,
      [ws(workspaceId), t.id]
    );
    await pool().query(
      `INSERT INTO music_imported_seeds
         (workspace_id, seed_id, title, author, category, style_tags, language, death_year,
          source_url, source_type, priority, note, import_batch_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (workspace_id, seed_id) DO UPDATE SET
         title = EXCLUDED.title,
         author = EXCLUDED.author,
         category = EXCLUDED.category,
         style_tags = EXCLUDED.style_tags,
         language = EXCLUDED.language,
         death_year = EXCLUDED.death_year,
         source_url = EXCLUDED.source_url,
         source_type = EXCLUDED.source_type,
         priority = EXCLUDED.priority,
         note = EXCLUDED.note,
         import_batch_id = EXCLUDED.import_batch_id`,
      [
        ws(workspaceId),
        t.id,
        t.title,
        t.author,
        t.category,
        t.styleTags,
        t.language,
        t.deathYear ?? null,
        t.sourceUrl,
        t.sourceType,
        t.priority,
        t.note,
        batchId,
      ]
    );
    if (existing) updated++;
    else added++;
  }
  return { batchId, added, updated, skipped };
}

export async function countImportedSeeds(workspaceId?: string): Promise<number> {
  const row = await pool().queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM music_imported_seeds WHERE workspace_id = $1`,
    [ws(workspaceId)]
  );
  return Number(row?.count ?? 0);
}
