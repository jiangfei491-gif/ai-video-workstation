import type { IPgPool } from "../pg/pool";
import type { PageParams, PageResult, UUID } from "../interfaces";
import type { LogRow } from "./interfaces";
import type {
  AnalysisStatus,
  AnalysisTaskRow,
  IAnalysisTaskRepository,
  IImportTaskRepository,
  ILibraryItemRepository,
  ImportStatus,
  ImportTaskRow,
  LibraryItemQuery,
  LibraryItemRow,
  AccessLogInput,
} from "./phase3-interfaces";

function parseAnalysisResult(raw: unknown): AnalysisTaskRow["analysis_result"] {
  if (raw && typeof raw === "object") return raw as AnalysisTaskRow["analysis_result"];
  return {};
}

function rowToAnalysis(r: AnalysisTaskRow): AnalysisTaskRow {
  return { ...r, analysis_result: parseAnalysisResult(r.analysis_result) };
}

function rowToLibraryItem(r: LibraryItemRow): LibraryItemRow {
  return {
    ...r,
    tags: r.tags ?? [],
    keywords: r.keywords ?? [],
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    rating: r.rating != null ? Number(r.rating) : null,
    quality_score: r.quality_score != null ? Number(r.quality_score) : null,
  };
}

export class PgAnalysisTaskRepository implements IAnalysisTaskRepository {
  constructor(private readonly pool: IPgPool) {}

  async findById(id: UUID): Promise<AnalysisTaskRow | null> {
    const row = await this.pool.queryOne<AnalysisTaskRow>(
      `SELECT * FROM resource_analysis_tasks WHERE id = $1`,
      [id]
    );
    return row ? rowToAnalysis(row) : null;
  }

  async findByDownloadTask(downloadTaskId: UUID): Promise<AnalysisTaskRow | null> {
    const row = await this.pool.queryOne<AnalysisTaskRow>(
      `SELECT * FROM resource_analysis_tasks WHERE download_task_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [downloadTaskId]
    );
    return row ? rowToAnalysis(row) : null;
  }

  async list(
    workspaceId: UUID,
    filters?: { status?: AnalysisStatus },
    params?: PageParams
  ): Promise<PageResult<AnalysisTaskRow>> {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const cond = ["workspace_id = $1"];
    const vals: unknown[] = [workspaceId];
    let i = 2;
    if (filters?.status) {
      cond.push(`status = $${i++}`);
      vals.push(filters.status);
    }
    const where = cond.join(" AND ");
    const { rows } = await this.pool.query<AnalysisTaskRow>(
      `SELECT * FROM resource_analysis_tasks WHERE ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset]
    );
    const c = await this.pool.queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM resource_analysis_tasks WHERE ${where}`,
      vals
    );
    return { items: rows.map(rowToAnalysis), total: c?.n ?? rows.length };
  }

  async create(input: {
    workspace_id: UUID;
    download_task_id?: UUID | null;
    source_id?: UUID | null;
    local_path: string;
    filename: string;
    mime_type?: string;
    file_size?: number;
    sha256?: string | null;
  }): Promise<AnalysisTaskRow> {
    const row = await this.pool.queryOne<AnalysisTaskRow>(
      `INSERT INTO resource_analysis_tasks (
        workspace_id, download_task_id, source_id, local_path, filename,
        mime_type, file_size, sha256, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending_analysis') RETURNING *`,
      [
        input.workspace_id,
        input.download_task_id ?? null,
        input.source_id ?? null,
        input.local_path,
        input.filename,
        input.mime_type ?? "",
        input.file_size ?? 0,
        input.sha256 ?? null,
      ]
    );
    return rowToAnalysis(row!);
  }

  async update(id: UUID, patch: Partial<AnalysisTaskRow>): Promise<AnalysisTaskRow | null> {
    const row = await this.pool.queryOne<AnalysisTaskRow>(
      `UPDATE resource_analysis_tasks SET
        status = COALESCE($2, status),
        library_id = COALESCE($3, library_id),
        analysis_result = COALESCE($4::jsonb, analysis_result),
        error_message = COALESCE($5, error_message),
        started_at = COALESCE($6, started_at),
        completed_at = COALESCE($7, completed_at),
        updated_at = NOW()
      WHERE id = $1 RETURNING *`,
      [
        id,
        patch.status ?? null,
        patch.library_id ?? null,
        patch.analysis_result ? JSON.stringify(patch.analysis_result) : null,
        patch.error_message ?? null,
        patch.started_at ?? null,
        patch.completed_at ?? null,
      ]
    );
    return row ? rowToAnalysis(row) : null;
  }

  async appendLog(taskId: UUID, level: string, message: string, payload?: Record<string, unknown>) {
    await this.pool.query(
      `INSERT INTO resource_analysis_logs (task_id, level, message, payload) VALUES ($1,$2,$3,$4::jsonb)`,
      [taskId, level, message, JSON.stringify(payload ?? {})]
    );
  }

  async listLogs(taskId: UUID, limit = 100): Promise<LogRow[]> {
    const { rows } = await this.pool.query<LogRow>(
      `SELECT * FROM resource_analysis_logs WHERE task_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [taskId, limit]
    );
    return rows;
  }
}

export class PgImportTaskRepository implements IImportTaskRepository {
  constructor(private readonly pool: IPgPool) {}

  async findById(id: UUID): Promise<ImportTaskRow | null> {
    return this.pool.queryOne(`SELECT * FROM resource_import_tasks WHERE id = $1`, [id]);
  }

  async list(
    workspaceId: UUID,
    filters?: { status?: ImportStatus; library_id?: string },
    params?: PageParams
  ): Promise<PageResult<ImportTaskRow>> {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const cond = ["workspace_id = $1"];
    const vals: unknown[] = [workspaceId];
    let i = 2;
    if (filters?.status) {
      cond.push(`status = $${i++}`);
      vals.push(filters.status);
    }
    if (filters?.library_id) {
      cond.push(`library_id = $${i++}`);
      vals.push(filters.library_id);
    }
    const where = cond.join(" AND ");
    const { rows } = await this.pool.query<ImportTaskRow>(
      `SELECT * FROM resource_import_tasks WHERE ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset]
    );
    const c = await this.pool.queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM resource_import_tasks WHERE ${where}`,
      vals
    );
    return { items: rows, total: c?.n ?? rows.length };
  }

  async create(input: {
    workspace_id: UUID;
    analysis_task_id: UUID;
    library_id: string;
  }): Promise<ImportTaskRow> {
    return (await this.pool.queryOne(
      `INSERT INTO resource_import_tasks (workspace_id, analysis_task_id, library_id, status)
       VALUES ($1,$2,$3,'pending_import') RETURNING *`,
      [input.workspace_id, input.analysis_task_id, input.library_id]
    ))!;
  }

  async update(id: UUID, patch: Partial<ImportTaskRow>): Promise<ImportTaskRow | null> {
    return this.pool.queryOne(
      `UPDATE resource_import_tasks SET
        status = COALESCE($2, status),
        library_item_id = COALESCE($3, library_item_id),
        error_message = COALESCE($4, error_message),
        started_at = COALESCE($5, started_at),
        completed_at = COALESCE($6, completed_at),
        updated_at = NOW()
      WHERE id = $1 RETURNING *`,
      [
        id,
        patch.status ?? null,
        patch.library_item_id ?? null,
        patch.error_message ?? null,
        patch.started_at ?? null,
        patch.completed_at ?? null,
      ]
    );
  }

  async appendLog(taskId: UUID, level: string, message: string, payload?: Record<string, unknown>) {
    await this.pool.query(
      `INSERT INTO resource_import_logs (task_id, level, message, payload) VALUES ($1,$2,$3,$4::jsonb)`,
      [taskId, level, message, JSON.stringify(payload ?? {})]
    );
  }

  async listLogs(taskId: UUID, limit = 100): Promise<LogRow[]> {
    const { rows } = await this.pool.query<LogRow>(
      `SELECT * FROM resource_import_logs WHERE task_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [taskId, limit]
    );
    return rows;
  }
}

function buildLibraryItemWhere(
  workspaceId: UUID,
  query?: LibraryItemQuery
): { where: string; vals: unknown[] } {
  const cond = ["workspace_id = $1", "deleted_at IS NULL"];
  const vals: unknown[] = [workspaceId];
  let i = 2;

  if (query?.library_id) {
    cond.push(`library_id = $${i++}`);
    vals.push(query.library_id);
  }
  if (query?.category) {
    cond.push(`category = $${i++}`);
    vals.push(query.category);
  }
  if (query?.tag) {
    cond.push(`$${i++} = ANY(tags)`);
    vals.push(query.tag);
  }
  if (query?.keyword) {
    cond.push(`$${i++} = ANY(keywords)`);
    vals.push(query.keyword);
  }
  if (query?.style) {
    cond.push(`style = $${i++}`);
    vals.push(query.style);
  }
  if (query?.mood) {
    cond.push(`mood = $${i++}`);
    vals.push(query.mood);
  }
  if (query?.language) {
    cond.push(`language = $${i++}`);
    vals.push(query.language);
  }
  if (query?.platform) {
    cond.push(`platform = $${i++}`);
    vals.push(query.platform);
  }
  if (query?.enabled !== undefined) {
    cond.push(`enabled = $${i++}`);
    vals.push(query.enabled);
  }
  if (query?.favorite !== undefined) {
    cond.push(`favorite = $${i++}`);
    vals.push(query.favorite);
  }
  if (query?.min_rating != null) {
    cond.push(`rating >= $${i++}`);
    vals.push(query.min_rating);
  }
  if (query?.min_quality != null) {
    cond.push(`quality_score >= $${i++}`);
    vals.push(query.min_quality);
  }
  if (query?.q?.trim()) {
    cond.push(`search_text @@ plainto_tsquery('simple', $${i++})`);
    vals.push(query.q.trim());
  }

  return { where: cond.join(" AND "), vals };
}

function libraryItemOrder(sort?: LibraryItemQuery["sort"]): string {
  switch (sort) {
    case "rating":
      return "rating DESC NULLS LAST, created_at DESC";
    case "quality":
      return "quality_score DESC NULLS LAST, created_at DESC";
    case "popular":
      return "quality_score DESC NULLS LAST, rating DESC NULLS LAST, created_at DESC";
    case "recent":
    default:
      return "created_at DESC";
  }
}

export class PgLibraryItemRepository implements ILibraryItemRepository {
  constructor(private readonly pool: IPgPool) {}

  async findById(id: UUID): Promise<LibraryItemRow | null> {
    const row = await this.pool.queryOne<LibraryItemRow>(
      `SELECT * FROM resource_library_items WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return row ? rowToLibraryItem(row) : null;
  }

  async findBySha256(workspaceId: UUID, sha256: string): Promise<LibraryItemRow | null> {
    const row = await this.pool.queryOne<LibraryItemRow>(
      `SELECT * FROM resource_library_items WHERE workspace_id = $1 AND sha256 = $2 AND deleted_at IS NULL LIMIT 1`,
      [workspaceId, sha256]
    );
    return row ? rowToLibraryItem(row) : null;
  }

  async list(workspaceId: UUID, query?: LibraryItemQuery): Promise<PageResult<LibraryItemRow>> {
    const limit = query?.limit ?? 50;
    const offset = query?.offset ?? 0;
    const { where, vals } = buildLibraryItemWhere(workspaceId, query);
    const order = libraryItemOrder(query?.sort);
    let i = vals.length + 1;
    const { rows } = await this.pool.query<LibraryItemRow>(
      `SELECT * FROM resource_library_items WHERE ${where} ORDER BY ${order} LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset]
    );
    const c = await this.pool.queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM resource_library_items WHERE ${where}`,
      vals
    );
    return { items: rows.map(rowToLibraryItem), total: c?.n ?? rows.length };
  }

  async count(workspaceId: UUID, query?: LibraryItemQuery): Promise<number> {
    const { where, vals } = buildLibraryItemWhere(workspaceId, query);
    const c = await this.pool.queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM resource_library_items WHERE ${where}`,
      vals
    );
    return c?.n ?? 0;
  }

  async create(
    input: Omit<LibraryItemRow, "id" | "created_at" | "updated_at" | "deleted_at">
  ): Promise<LibraryItemRow> {
    const searchBlob = [
      input.title,
      input.description,
      input.category,
      input.style,
      input.mood,
      input.purpose,
      ...(input.tags ?? []),
      ...(input.keywords ?? []),
    ]
      .filter(Boolean)
      .join(" ");

    const row = await this.pool.queryOne<LibraryItemRow>(
      `INSERT INTO resource_library_items (
        workspace_id, library_id, download_task_id, analysis_task_id, import_task_id, source_id,
        title, description, category, language, style, mood, purpose, platform, status,
        rating, quality_score, enabled, favorite, local_path, thumbnail_path, preview_path,
        tags, keywords, sha256, file_size, mime_type, metadata, db_primary_table, db_record_id,
        search_text
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28::jsonb,$29,$30,
        to_tsvector('simple', $31)
      ) RETURNING *`,
      [
        input.workspace_id,
        input.library_id,
        input.download_task_id,
        input.analysis_task_id,
        input.import_task_id,
        input.source_id,
        input.title,
        input.description,
        input.category,
        input.language,
        input.style,
        input.mood,
        input.purpose,
        input.platform,
        input.status,
        input.rating,
        input.quality_score,
        input.enabled,
        input.favorite,
        input.local_path,
        input.thumbnail_path,
        input.preview_path,
        input.tags,
        input.keywords,
        input.sha256,
        input.file_size,
        input.mime_type,
        JSON.stringify(input.metadata ?? {}),
        input.db_primary_table,
        input.db_record_id,
        searchBlob,
      ]
    );
    return rowToLibraryItem(row!);
  }

  async update(id: UUID, patch: Partial<LibraryItemRow>): Promise<LibraryItemRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const merged = { ...existing, ...patch };
    const searchBlob = [
      merged.title,
      merged.description,
      merged.category,
      merged.style,
      merged.mood,
      merged.purpose,
      ...(merged.tags ?? []),
      ...(merged.keywords ?? []),
    ]
      .filter(Boolean)
      .join(" ");

    const row = await this.pool.queryOne<LibraryItemRow>(
      `UPDATE resource_library_items SET
        title = $2, description = $3, category = $4, language = $5, style = $6, mood = $7,
        purpose = $8, platform = $9, status = $10, rating = $11, quality_score = $12,
        enabled = $13, favorite = $14, tags = $15, keywords = $16, metadata = $17::jsonb,
        search_text = to_tsvector('simple', $18), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [
        id,
        merged.title,
        merged.description,
        merged.category,
        merged.language,
        merged.style,
        merged.mood,
        merged.purpose,
        merged.platform,
        merged.status,
        merged.rating,
        merged.quality_score,
        merged.enabled,
        merged.favorite,
        merged.tags,
        merged.keywords,
        JSON.stringify(merged.metadata ?? {}),
        searchBlob,
      ]
    );
    return row ? rowToLibraryItem(row) : null;
  }

  async softDelete(id: UUID): Promise<boolean> {
    const row = await this.pool.queryOne<{ id: string }>(
      `UPDATE resource_library_items SET status = 'deleted', deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    return Boolean(row);
  }

  async recordAccess(workspaceId: UUID, input: AccessLogInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO resource_access_logs (workspace_id, module_id, module_label, query, result_count)
       VALUES ($1,$2,$3,$4::jsonb,$5)`,
      [
        workspaceId,
        input.module_id,
        input.module_label ?? input.module_id,
        JSON.stringify(input.query),
        input.result_count,
      ]
    );
  }

  async addRelation(
    workspaceId: UUID,
    itemIdA: UUID,
    itemIdB: UUID,
    relationType: string,
    score?: number
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO resource_library_relations (workspace_id, item_id_a, item_id_b, relation_type, score)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (item_id_a, item_id_b, relation_type) DO UPDATE SET score = EXCLUDED.score`,
      [workspaceId, itemIdA, itemIdB, relationType, score ?? null]
    );
  }

  async findSimilar(itemId: UUID, limit = 10): Promise<LibraryItemRow[]> {
    const item = await this.findById(itemId);
    if (!item) return [];

    const { rows: relRows } = await this.pool.query<{ item_id_b: string }>(
      `SELECT item_id_b FROM resource_library_relations
       WHERE item_id_a = $1 AND relation_type IN ('similar', 'duplicate')
       ORDER BY score DESC NULLS LAST LIMIT $2`,
      [itemId, limit]
    );
    if (relRows.length > 0) {
      const ids = relRows.map((r) => r.item_id_b);
      const { rows } = await this.pool.query<LibraryItemRow>(
        `SELECT * FROM resource_library_items WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
        [ids]
      );
      return rows.map(rowToLibraryItem);
    }

    const { rows } = await this.pool.query<LibraryItemRow>(
      `SELECT * FROM resource_library_items
       WHERE workspace_id = $1 AND library_id = $2 AND id != $3 AND deleted_at IS NULL
         AND (category = $4 OR tags && $5::text[])
       ORDER BY quality_score DESC NULLS LAST, rating DESC NULLS LAST
       LIMIT $6`,
      [item.workspace_id, item.library_id, itemId, item.category, item.tags, limit]
    );
    return rows.map(rowToLibraryItem);
  }
}

export function createResourceCenterPhase3RepositoryBundle(pool: IPgPool) {
  return {
    analysisTask: new PgAnalysisTaskRepository(pool),
    importTask: new PgImportTaskRepository(pool),
    libraryItem: new PgLibraryItemRepository(pool),
  };
}
