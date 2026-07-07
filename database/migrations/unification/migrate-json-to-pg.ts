import fs from "node:fs";
import path from "node:path";

import { legacyImportProjectsDir, legacyImportSourceRoot } from "./legacy-import-source";
import type { IPgPool } from "../../repositories/pg/pool";
import { LIBRARY_JSON_FILES } from "./constants";
import { ensureDefaultIdentity, ensureDefaultProject } from "./bootstrap-db";
import { ensureLibraryJsonBackupDir } from "./unified-mode";
import { DEFAULT_PROJECT_ID, DEFAULT_WORKSPACE_ID } from "./constants";

function readLegacyJson(name: string): unknown[] {
  const legacyPath = path.join(legacyImportProjectsDir(), name);
  if (!fs.existsSync(legacyPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function copyJsonBackup(name: string): number {
  const items = readLegacyJson(name);
  if (items.length === 0 && !fs.existsSync(path.join(legacyImportProjectsDir(), name))) {
    return 0;
  }
  const dest = ensureLibraryJsonBackupDir(name);
  if (!fs.existsSync(dest)) {
    const src = path.join(legacyImportProjectsDir(), name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    } else {
      fs.writeFileSync(dest, JSON.stringify(items, null, 2), "utf8");
    }
  }
  return items.length;
}

async function upsertLegacyMapping(
  pool: IPgPool,
  source: string,
  legacyKey: string,
  entityType: string,
  entityId: string
): Promise<void> {
  await pool.query(
    `INSERT INTO legacy_json_mappings (source, legacy_key, entity_type, entity_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (source, legacy_key, entity_type) DO NOTHING`,
    [source, legacyKey, entityType, entityId]
  );
}

export async function migrateJsonLibraryToPg(pool: IPgPool): Promise<{
  materials: number;
  characters: number;
  scenes: number;
  props: number;
  assets: number;
}> {
  await ensureDefaultIdentity(pool);
  await ensureDefaultProject(pool);

  const counts = { materials: 0, characters: 0, scenes: 0, props: 0, assets: 0 };

  for (const name of LIBRARY_JSON_FILES) {
    copyJsonBackup(name);
  }

  for (const m of readLegacyJson("materials.json") as Array<Record<string, unknown>>) {
    const legacyId = String(m.id ?? "");
    const existing = await pool.queryOne<{ id: string }>(
      "SELECT id FROM materials WHERE workspace_id = $1 AND legacy_json_id = $2",
      [DEFAULT_WORKSPACE_ID, legacyId]
    );
    if (existing) {
      counts.materials += 1;
      continue;
    }
    const row = await pool.queryOne<{ id: string }>(
      `INSERT INTO materials (workspace_id, title, content, source, url, category, language, status, favorite, legacy_json_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11::timestamptz,NOW()),COALESCE($12::timestamptz,NOW()))
       RETURNING id`,
      [
        DEFAULT_WORKSPACE_ID,
        String(m.title ?? ""),
        String(m.content ?? m.rawContent ?? ""),
        String(m.source ?? ""),
        String(m.url ?? ""),
        String(m.category ?? ""),
        m.language ?? "zh",
        String(m.status ?? "待分析"),
        Boolean(m.favorite),
        legacyId,
        m.createdAt ?? null,
        m.updatedAt ?? null,
      ]
    );
    if (row) {
      counts.materials += 1;
      await upsertLegacyMapping(pool, "materials.json", legacyId, "material", row.id);
      const analysis = m.analysis as Record<string, unknown> | undefined;
      if (analysis) {
        await pool.query(
          `INSERT INTO material_analyses (material_id, summary, analysis, score, model_slug, usage)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (material_id) DO NOTHING`,
          [
            row.id,
            String(analysis.summary ?? ""),
            JSON.stringify(analysis),
            analysis.score ?? null,
            analysis.model ?? null,
            JSON.stringify(analysis.usage ?? {}),
          ]
        );
      }
    }
  }

  for (const c of readLegacyJson("characters.json") as Array<Record<string, unknown>>) {
    const legacyId = String(c.id ?? "");
    const existing = await pool.queryOne<{ id: string }>(
      "SELECT id FROM characters WHERE workspace_id = $1 AND legacy_json_id = $2",
      [DEFAULT_WORKSPACE_ID, legacyId]
    );
    if (existing) {
      counts.characters += 1;
      continue;
    }
    const row = await pool.queryOne<{ id: string }>(
      `INSERT INTO characters (workspace_id, name, appearance, payload, legacy_json_id, created_at)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz,NOW())) RETURNING id`,
      [
        DEFAULT_WORKSPACE_ID,
        String(c.name ?? legacyId),
        String(c.appearance ?? ""),
        JSON.stringify(c),
        legacyId,
        c.createdAt ?? null,
      ]
    );
    if (row) {
      counts.characters += 1;
      await upsertLegacyMapping(pool, "characters.json", legacyId, "character", row.id);
    }
  }

  for (const s of readLegacyJson("scenes.json") as Array<Record<string, unknown>>) {
    const legacyId = String(s.id ?? "");
    const existing = await pool.queryOne<{ id: string }>(
      "SELECT id FROM scenes WHERE workspace_id = $1 AND legacy_json_id = $2",
      [DEFAULT_WORKSPACE_ID, legacyId]
    );
    if (existing) {
      counts.scenes += 1;
      continue;
    }
    const row = await pool.queryOne<{ id: string }>(
      `INSERT INTO scenes (workspace_id, name, description, payload, legacy_json_id, created_at)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz,NOW())) RETURNING id`,
      [
        DEFAULT_WORKSPACE_ID,
        String(s.name ?? legacyId),
        String(s.description ?? ""),
        JSON.stringify(s),
        legacyId,
        s.createdAt ?? null,
      ]
    );
    if (row) {
      counts.scenes += 1;
      await upsertLegacyMapping(pool, "scenes.json", legacyId, "scene", row.id);
    }
  }

  for (const p of readLegacyJson("props.json") as Array<Record<string, unknown>>) {
    const legacyId = String(p.id ?? "");
    const existing = await pool.queryOne<{ id: string }>(
      "SELECT id FROM props WHERE workspace_id = $1 AND legacy_json_id = $2",
      [DEFAULT_WORKSPACE_ID, legacyId]
    );
    if (existing) {
      counts.props += 1;
      continue;
    }
    const row = await pool.queryOne<{ id: string }>(
      `INSERT INTO props (workspace_id, name, description, category, payload, legacy_json_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,NOW())) RETURNING id`,
      [
        DEFAULT_WORKSPACE_ID,
        String(p.name ?? legacyId),
        String(p.description ?? ""),
        String(p.category ?? ""),
        JSON.stringify(p),
        legacyId,
        p.createdAt ?? null,
      ]
    );
    if (row) {
      counts.props += 1;
      await upsertLegacyMapping(pool, "props.json", legacyId, "prop", row.id);
    }
  }

  for (const a of readLegacyJson("image-assets.json") as Array<Record<string, unknown>>) {
    const legacyId = String(a.id ?? "");
    const existing = await pool.queryOne("SELECT id FROM assets WHERE workspace_id = $1 AND metadata->>'legacy_json_id' = $2", [
      DEFAULT_WORKSPACE_ID,
      legacyId,
    ]);
    if (existing) {
      counts.assets += 1;
      continue;
    }
    const kind = String(a.sourceClipUrl ?? a.shotId ?? "").includes("video") ? "video" : "image";
    const filepath = String(a.filepath ?? a.publicUrl ?? "");
    const row = await pool.queryOne<{ id: string }>(
      `INSERT INTO assets (workspace_id, project_id, kind, storage_key, public_url, filename, width, height, duration_sec, source, metadata, legacy_filepath)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        DEFAULT_WORKSPACE_ID,
        DEFAULT_PROJECT_ID,
        a.mode ? "video" : kind,
        filepath.replace(/^\/api\/files\//, ""),
        String(a.publicUrl ?? ""),
        path.basename(filepath),
        a.width ?? null,
        a.height ?? null,
        a.durationSec ?? null,
        String(a.source ?? a.model ?? ""),
        JSON.stringify({ ...a, legacy_json_id: legacyId }),
        filepath,
      ]
    );
    if (row) {
      counts.assets += 1;
      await upsertLegacyMapping(pool, "image-assets.json", legacyId, "asset", row.id);
    }
  }

  return counts;
}

export function libraryJsonReadPath(name: string): string {
  const backup = ensureLibraryJsonBackupDir(name);
  if (fs.existsSync(backup)) return backup;
  return path.join(legacyImportProjectsDir(), name);
}
