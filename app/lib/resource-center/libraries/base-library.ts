import fs from "node:fs";
import path from "node:path";

import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import { createPgPool } from "@/database/repositories/pg/pool";

import type {
  ILibrary,
  LibraryDefinition,
  LibraryListQuery,
  LibraryListResult,
  LibraryStats,
  ResourceItemMeta,
} from "../types";
import { resolveLibraryMetaPath, resolveLibraryStoragePath } from "../paths";

function countStorageFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isFile()) count += 1;
  }
  return count;
}

function latestMtime(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  let max = 0;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const fp = path.join(dir, name);
    try {
      const st = fs.statSync(fp);
      max = Math.max(max, st.mtimeMs);
    } catch {
      /* skip */
    }
  }
  return max > 0 ? new Date(max).toISOString() : null;
}

async function countDbRecords(def: LibraryDefinition): Promise<number> {
  const table = def.dbMapping.primaryTable;
  if (!table) return 0;

  try {
    const pool = createPgPool();
    try {
      let sql: string;
      const params: unknown[] = [DEFAULT_WORKSPACE_ID];

      if (table === "assets") {
        const kinds = def.dbMapping.assetKinds ?? [];
        if (kinds.length === 0) return 0;
        sql = `SELECT COUNT(*)::int AS c FROM assets WHERE workspace_id = $1 AND kind::text = ANY($2::text[]) AND deleted_at IS NULL`;
        params.push(kinds);
      } else if (table === "characters" || table === "scenes" || table === "props") {
        sql = `SELECT COUNT(*)::int AS c FROM ${table} WHERE workspace_id = $1 AND deleted_at IS NULL`;
      } else if (table === "prompts") {
        sql = `SELECT COUNT(*)::int AS c FROM prompts WHERE workspace_id = $1`;
      } else if (table === "templates") {
        const kind = def.dbMapping.templateKind;
        if (!kind) return 0;
        sql = `SELECT COUNT(*)::int AS c FROM templates WHERE workspace_id = $1 AND template_kind = $2`;
        params.push(kind);
      } else if (
        table === "music_library" ||
        table === "voice_library" ||
        table === "subtitle_library" ||
        table === "effects_library"
      ) {
        sql = `SELECT COUNT(*)::int AS c FROM ${table} WHERE workspace_id = $1 OR workspace_id IS NULL`;
      } else if (table === "glossaries") {
        sql = `SELECT COUNT(*)::int AS c FROM glossaries WHERE workspace_id = $1`;
      } else if (table === "materials") {
        sql = `SELECT COUNT(*)::int AS c FROM materials WHERE workspace_id = $1 AND deleted_at IS NULL`;
      } else {
        return 0;
      }

      const row = await pool.queryOne<{ c: number }>(sql, params);
      return row?.c ?? 0;
    } finally {
      await pool.end();
    }
  } catch {
    return 0;
  }
}

export class BaseLibrary implements ILibrary {
  constructor(readonly definition: LibraryDefinition) {}

  getStoragePath(): string {
    return resolveLibraryStoragePath(this.definition.id);
  }

  ensureLayout(): void {
    const root = this.getStoragePath();
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync(resolveLibraryMetaPath(this.definition.id), { recursive: true });
    const metaFile = path.join(resolveLibraryMetaPath(this.definition.id), "library.json");
    if (!fs.existsSync(metaFile)) {
      fs.writeFileSync(
        metaFile,
        JSON.stringify(
          {
            version: 1,
            libraryId: this.definition.id,
            slug: this.definition.slug,
            categories: this.definition.categories,
            capabilities: this.definition.capabilities,
            createdAt: new Date().toISOString(),
          },
          null,
          2
        ),
        "utf8"
      );
    }
  }

  async getStats(): Promise<LibraryStats> {
    const storagePath = this.getStoragePath();
    const fileCount = countStorageFiles(storagePath);
    const dbRecordCount = await countDbRecords(this.definition);
    const resourceCount = Math.max(fileCount, dbRecordCount);
    return {
      resourceCount,
      fileCount,
      enabledCount: resourceCount,
      disabledCount: 0,
      favoriteCount: 0,
      dbRecordCount,
      lastUpdatedAt: latestMtime(storagePath),
    };
  }

  async list(_query?: LibraryListQuery): Promise<LibraryListResult> {
    const stats = await this.getStats();
    return { items: [], total: 0, stats };
  }

  async getById(_id: string): Promise<ResourceItemMeta | null> {
    return null;
  }
}
