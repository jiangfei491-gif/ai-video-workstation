import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import { getOrCreateDefaultPool, type IPgPool } from "@/database/repositories/pg/pool";
import type { StoredFileResult } from "./storage";
import {
  DEFAULT_MUSIC_SETTINGS,
  type MusicSettings,
  type OriginalLyric,
  type OriginalPrompt,
  type OriginalVersion,
  type PublicLyric,
  type SyncRun,
} from "./types";

function pool(): IPgPool {
  return getOrCreateDefaultPool();
}
function ws(id?: string): string {
  return id ?? DEFAULT_WORKSPACE_ID;
}

// ── row mappers ──────────────────────────────────────────────────────────────

function mapPublic(r: Record<string, unknown>): PublicLyric {
  const scoreDetails = r.score_details as PublicLyric["scoreDetails"];
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    title: String(r.title),
    titleZh: String(r.title_zh ?? ""),
    author: String(r.author ?? ""),
    birthYear: r.birth_year != null ? Number(r.birth_year) : undefined,
    deathYear: r.death_year != null ? Number(r.death_year) : undefined,
    country: String(r.country ?? ""),
    language: String(r.language ?? ""),
    firstPublished: String(r.first_published ?? ""),
    sourceUrl: String(r.source_url ?? ""),
    category: String(r.category ?? "其它"),
    moodTags: Array.isArray(r.mood_tags) ? (r.mood_tags as string[]) : [],
    sceneTags: Array.isArray(r.scene_tags) ? (r.scene_tags as string[]) : [],
    styleTags: Array.isArray(r.style_tags) ? (r.style_tags as string[]) : [],
    themeTags: Array.isArray(r.theme_tags) ? (r.theme_tags as string[]) : [],
    commercialTags: Array.isArray(r.commercial_tags) ? (r.commercial_tags as string[]) : [],
    overallScore: Number(r.overall_score ?? 0),
    coverHotness: String(r.cover_hotness ?? ""),
    scoreDetails,
    contentPreview: String(r.content_preview ?? ""),
    lyricZhRemark: String(r.lyric_zh_remark ?? ""),
    contentFileId: r.content_file_id ? String(r.content_file_id) : undefined,
    rawHtmlFileId: r.raw_html_file_id ? String(r.raw_html_file_id) : undefined,
    syncedBy: String(r.synced_by ?? "gpt"),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapOriginal(r: Record<string, unknown>): OriginalLyric {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    title: String(r.title),
    titleZh: String(r.title_zh ?? ""),
    language: String(r.language ?? "zh"),
    prompt: (r.prompt as OriginalPrompt) ?? {},
    contentPreview: String(r.content_preview ?? ""),
    lyricZhRemark: String(r.lyric_zh_remark ?? ""),
    contentFileId: r.content_file_id ? String(r.content_file_id) : undefined,
    currentVersionId: r.current_version_id ? String(r.current_version_id) : undefined,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

// ── storage file registry ────────────────────────────────────────────────────

export async function registerStorageFile(stored: StoredFileResult, workspaceId?: string): Promise<string> {
  const row = await pool().queryOne<{ id: string }>(
    `INSERT INTO music_storage_files
       (workspace_id, category, relative_path, filename, mime_type, size_bytes, sha256, is_immutable)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING id`,
    [ws(workspaceId), stored.category, stored.relativePath, stored.filename, stored.mimeType, stored.sizeBytes, stored.sha256]
  );
  return row!.id;
}

export async function getBodyByFileId(fileId: string): Promise<string | null> {
  const row = await pool().queryOne<{ relative_path: string }>(
    `SELECT relative_path FROM music_storage_files WHERE id = $1`,
    [fileId]
  );
  if (!row) return null;
  const { readStoredText } = await import("./storage");
  return readStoredText(row.relative_path);
}

// ── settings ─────────────────────────────────────────────────────────────────

export async function getSettings(workspaceId?: string): Promise<MusicSettings> {
  const row = await pool().queryOne<{ settings: Partial<MusicSettings> }>(
    `SELECT settings FROM music_settings WHERE workspace_id = $1`,
    [ws(workspaceId)]
  );
  return { ...DEFAULT_MUSIC_SETTINGS, ...(row?.settings ?? {}) };
}

export async function saveSettings(patch: Partial<MusicSettings>, workspaceId?: string): Promise<MusicSettings> {
  const current = await getSettings(workspaceId);
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  const next = { ...current, ...clean };
  await pool().query(
    `INSERT INTO music_settings (workspace_id, settings, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET settings = $2::jsonb, updated_at = NOW()`,
    [ws(workspaceId), JSON.stringify(next)]
  );
  return next;
}

// ── public lyrics ────────────────────────────────────────────────────────────

export type PublicQuery = {
  q?: string;
  category?: string;
  mood?: string;
  scene?: string;
  style?: string;
  theme?: string;
  commercial?: string;
  minScore?: number;
  page?: number;
  pageSize?: number;
};

export async function listPublicLyrics(
  query: PublicQuery = {},
  workspaceId?: string
): Promise<{ items: PublicLyric[]; total: number }> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 24));
  const offset = (page - 1) * pageSize;
  const conds = ["workspace_id = $1"];
  const params: unknown[] = [ws(workspaceId)];
  let i = 2;

  if (query.q) {
    conds.push(`(title ILIKE $${i} OR title_zh ILIKE $${i} OR author ILIKE $${i} OR content_preview ILIKE $${i} OR lyric_zh_remark ILIKE $${i})`);
    params.push(`%${query.q}%`);
    i++;
  }
  if (query.category) {
    conds.push(`category = $${i}`);
    params.push(query.category);
    i++;
  }
  if (query.mood) {
    conds.push(`$${i} = ANY(mood_tags)`);
    params.push(query.mood);
    i++;
  }
  if (query.scene) {
    conds.push(`$${i} = ANY(scene_tags)`);
    params.push(query.scene);
    i++;
  }
  if (query.style) {
    conds.push(`$${i} = ANY(style_tags)`);
    params.push(query.style);
    i++;
  }
  if (query.theme) {
    conds.push(`category = $${i}`);
    params.push(query.theme);
    i++;
  }
  if (query.commercial) {
    conds.push(`$${i} = ANY(commercial_tags)`);
    params.push(query.commercial);
    i++;
  }
  if (query.minScore != null && query.minScore > 0) {
    conds.push(`overall_score >= $${i}`);
    params.push(query.minScore);
    i++;
  }

  const where = conds.join(" AND ");
  const countRow = await pool().queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM music_public_lyrics WHERE ${where}`,
    params
  );
  const { rows } = await pool().query(
    `SELECT * FROM music_public_lyrics WHERE ${where} ORDER BY overall_score DESC, updated_at DESC LIMIT $${i} OFFSET $${i + 1}`,
    [...params, pageSize, offset]
  );
  return { items: rows.map(mapPublic), total: Number(countRow?.count ?? 0) };
}

export async function getPublicLyric(id: string): Promise<PublicLyric | null> {
  const row = await pool().queryOne<Record<string, unknown>>(`SELECT * FROM music_public_lyrics WHERE id = $1`, [id]);
  if (!row) return null;
  const lyric = mapPublic(row);
  if (lyric.contentFileId) lyric.body = (await getBodyByFileId(lyric.contentFileId)) ?? "";
  return lyric;
}

export async function publicLyricExists(dedupeKey: string, workspaceId?: string): Promise<boolean> {
  const row = await pool().queryOne<{ id: string }>(
    `SELECT id FROM music_public_lyrics WHERE workspace_id = $1 AND dedupe_key = $2`,
    [ws(workspaceId), dedupeKey]
  );
  return Boolean(row);
}

export type InsertPublicInput = {
  title: string;
  titleZh: string;
  author: string;
  birthYear?: number;
  deathYear?: number;
  country: string;
  language: string;
  firstPublished: string;
  sourceUrl: string;
  category: string;
  moodTags: string[];
  sceneTags: string[];
  styleTags: string[];
  themeTags: string[];
  commercialTags: string[];
  overallScore: number;
  coverHotness: string;
  scoreDetails?: PublicLyric["scoreDetails"];
  body: string;
  lyricZhRemark: string;
  dedupeKey: string;
  fingerprint: string;
  contentFileId?: string;
  rawHtmlFileId?: string;
  metadata?: Record<string, unknown>;
};

export async function insertPublicLyric(input: InsertPublicInput, workspaceId?: string): Promise<PublicLyric | null> {
  const preview = input.body.slice(0, 600);
  const row = await pool().queryOne<Record<string, unknown>>(
    `INSERT INTO music_public_lyrics
       (workspace_id, title, title_zh, author, birth_year, death_year, country, language, first_published,
        source_url, category, mood_tags, scene_tags, style_tags, theme_tags, commercial_tags,
        overall_score, cover_hotness, score_details,
        content_preview, lyric_zh_remark, content_file_id, raw_html_file_id, dedupe_key, fingerprint, synced_by, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,'gpt',$26)
     ON CONFLICT (workspace_id, dedupe_key) DO NOTHING
     RETURNING *`,
    [
      ws(workspaceId),
      input.title,
      input.titleZh,
      input.author,
      input.birthYear ?? null,
      input.deathYear ?? null,
      input.country,
      input.language,
      input.firstPublished,
      input.sourceUrl,
      input.category,
      input.moodTags,
      input.sceneTags,
      input.styleTags,
      input.themeTags,
      input.commercialTags,
      input.overallScore,
      input.coverHotness,
      JSON.stringify(input.scoreDetails ?? {}),
      preview,
      input.lyricZhRemark,
      input.contentFileId ?? null,
      input.rawHtmlFileId ?? null,
      input.dedupeKey,
      input.fingerprint,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  if (!row) return null;
  return mapPublic(row);
}

export async function addEvidence(
  lyricId: string,
  evidenceType: string,
  title: string,
  url: string,
  fileId?: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await pool().query(
    `INSERT INTO music_public_lyric_evidence (lyric_id, evidence_type, title, url, file_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [lyricId, evidenceType, title, url, fileId ?? null, JSON.stringify(metadata)]
  );
}

// ── sync runs ────────────────────────────────────────────────────────────────

export async function startSyncRun(trigger: string, model: string, workspaceId?: string): Promise<string> {
  const row = await pool().queryOne<{ id: string }>(
    `INSERT INTO music_sync_runs (workspace_id, trigger, status, model) VALUES ($1,$2,'running',$3) RETURNING id`,
    [ws(workspaceId), trigger, model]
  );
  return row!.id;
}

export async function finishSyncRun(
  id: string,
  result: { status: string; found: number; added: number; skipped: number; failed: number; error?: string }
): Promise<void> {
  await pool().query(
    `UPDATE music_sync_runs SET status = $2, found_count = $3, added_count = $4,
       skipped_count = $5, failed_count = $6, error_message = $7, finished_at = NOW()
     WHERE id = $1`,
    [id, result.status, result.found, result.added, result.skipped, result.failed, result.error ?? null]
  );
}

export async function latestSyncRun(workspaceId?: string): Promise<SyncRun | null> {
  const row = await pool().queryOne<Record<string, unknown>>(
    `SELECT * FROM music_sync_runs WHERE workspace_id = $1 ORDER BY started_at DESC LIMIT 1`,
    [ws(workspaceId)]
  );
  if (!row) return null;
  return {
    id: String(row.id),
    trigger: String(row.trigger),
    status: String(row.status),
    foundCount: Number(row.found_count),
    addedCount: Number(row.added_count),
    skippedCount: Number(row.skipped_count),
    failedCount: Number(row.failed_count),
    model: String(row.model),
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : undefined,
  };
}

// ── original lyrics ──────────────────────────────────────────────────────────

export async function listOriginalLyrics(
  workspaceId?: string,
  page = 1,
  pageSize = 30
): Promise<{ items: OriginalLyric[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const countRow = await pool().queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM music_original_lyrics WHERE workspace_id = $1`,
    [ws(workspaceId)]
  );
  const { rows } = await pool().query(
    `SELECT * FROM music_original_lyrics WHERE workspace_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,
    [ws(workspaceId), pageSize, offset]
  );
  return { items: rows.map(mapOriginal), total: Number(countRow?.count ?? 0) };
}

export async function getOriginalLyric(id: string): Promise<OriginalLyric | null> {
  const row = await pool().queryOne<Record<string, unknown>>(`SELECT * FROM music_original_lyrics WHERE id = $1`, [id]);
  if (!row) return null;
  const lyric = mapOriginal(row);
  if (lyric.contentFileId) lyric.body = (await getBodyByFileId(lyric.contentFileId)) ?? "";
  return lyric;
}

/** 创建原创歌词 + 首个版本 */
export async function createOriginalLyric(
  title: string,
  body: string,
  prompt: OriginalPrompt,
  opts: { titleZh?: string; lyricZhRemark?: string } = {},
  workspaceId?: string
): Promise<OriginalLyric> {
  const { writeImmutableFile } = await import("./storage");
  const stored = writeImmutableFile("original", `original-${Date.now()}.txt`, body, "text/plain; charset=utf-8");
  const fileId = await registerStorageFile(stored, workspaceId);
  const preview = body.slice(0, 600);

  const row = await pool().queryOne<Record<string, unknown>>(
    `INSERT INTO music_original_lyrics
       (workspace_id, title, title_zh, language, prompt, content_preview, lyric_zh_remark, content_file_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [ws(workspaceId), title, opts.titleZh ?? "", prompt.language ?? "zh", JSON.stringify(prompt), preview, opts.lyricZhRemark ?? "", fileId]
  );
  const lyricId = String(row!.id);
  const versionId = await addOriginalVersion(lyricId, body, "初始生成", "gpt");
  await pool().query(`UPDATE music_original_lyrics SET current_version_id = $2 WHERE id = $1`, [lyricId, versionId]);
  return mapOriginal(row!);
}

/** 新版本（重新生成/继续/修改）— 禁止覆盖 */
export async function addOriginalVersion(
  lyricId: string,
  body: string,
  note: string,
  createdBy = "gpt"
): Promise<string> {
  const { writeImmutableFile } = await import("./storage");
  const stored = writeImmutableFile("versions", `original-${lyricId}.txt`, body, "text/plain; charset=utf-8");
  const fileId = await registerStorageFile(stored);
  const maxRow = await pool().queryOne<{ max: string }>(
    `SELECT COALESCE(MAX(version_no),0)::text AS max FROM music_original_lyric_versions WHERE lyric_id = $1`,
    [lyricId]
  );
  const versionNo = Number(maxRow?.max ?? 0) + 1;
  const preview = body.slice(0, 600);
  const ver = await pool().queryOne<{ id: string }>(
    `INSERT INTO music_original_lyric_versions (lyric_id, version_no, note, content_preview, content_file_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [lyricId, versionNo, note, preview, fileId, createdBy]
  );
  await pool().query(
    `UPDATE music_original_lyrics SET current_version_id = $2, content_file_id = $3, content_preview = $4, updated_at = NOW() WHERE id = $1`,
    [lyricId, ver!.id, fileId, preview]
  );
  return ver!.id;
}

/** 保存用户手动编辑（作为新版本） */
export async function saveOriginalEdit(lyricId: string, body: string, title?: string): Promise<string> {
  if (title != null) {
    await pool().query(`UPDATE music_original_lyrics SET title = $2, updated_at = NOW() WHERE id = $1`, [lyricId, title]);
  }
  return addOriginalVersion(lyricId, body, "手动保存", "human");
}

export async function listOriginalVersions(lyricId: string): Promise<OriginalVersion[]> {
  const { rows } = await pool().query(
    `SELECT * FROM music_original_lyric_versions WHERE lyric_id = $1 ORDER BY version_no DESC`,
    [lyricId]
  );
  return rows.map((r) => ({
    id: String(r.id),
    lyricId: String(r.lyric_id),
    versionNo: Number(r.version_no),
    note: String(r.note),
    contentPreview: String(r.content_preview),
    contentFileId: r.content_file_id ? String(r.content_file_id) : undefined,
    createdBy: String(r.created_by),
    createdAt: String(r.created_at),
  }));
}

export async function deleteOriginalLyric(id: string): Promise<void> {
  await pool().query(`DELETE FROM music_original_lyrics WHERE id = $1`, [id]);
}
