import type { IPgPool } from "../pg/pool";
import type {
  CrawlerTaskRow,
  DownloadTaskRow,
  ICrawlerTaskRepository,
  IDownloadTaskRepository,
  IResourceSourceRepository,
  LogRow,
  ResourceSourceInput,
  ResourceSourceQuery,
  ResourceSourceRow,
  TaskStatus,
} from "./interfaces";
import type { PageParams, PageResult, UUID } from "../interfaces";

function rowToSource(r: ResourceSourceRow): ResourceSourceRow {
  return { ...r, metadata: (r.metadata as Record<string, unknown>) ?? {} };
}

export class PgResourceSourceRepository implements IResourceSourceRepository {
  constructor(private readonly pool: IPgPool) {}

  async findById(id: UUID): Promise<ResourceSourceRow | null> {
    const row = await this.pool.queryOne<ResourceSourceRow>(
      `SELECT * FROM resource_sources WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return row ? rowToSource(row) : null;
  }

  async list(
    workspaceId: UUID,
    query?: ResourceSourceQuery,
    params?: PageParams
  ): Promise<PageResult<ResourceSourceRow>> {
    const limit = params?.limit ?? 100;
    const offset = params?.offset ?? 0;
    const conditions = ["workspace_id = $1", "deleted_at IS NULL"];
    const values: unknown[] = [workspaceId];
    let idx = 2;

    if (query?.q) {
      conditions.push(`(name ILIKE $${idx} OR url ILIKE $${idx} OR notes ILIKE $${idx})`);
      values.push(`%${query.q}%`);
      idx++;
    }
    if (query?.site_category) {
      conditions.push(`site_category = $${idx++}`);
      values.push(query.site_category);
    }
    if (query?.resource_type) {
      conditions.push(`$${idx++} = ANY(resource_types)`);
      values.push(query.resource_type);
    }
    if (query?.enabled !== undefined) {
      conditions.push(`enabled = $${idx++}`);
      values.push(query.enabled);
    }
    if (query?.status) {
      conditions.push(`status = $${idx++}`);
      values.push(query.status);
    }

    const sort = query?.sort === "name" ? "name" : query?.sort === "created_at" ? "created_at" : "updated_at";
    const order = query?.order === "asc" ? "ASC" : "DESC";
    const where = conditions.join(" AND ");

    const { rows } = await this.pool.query<ResourceSourceRow>(
      `SELECT * FROM resource_sources WHERE ${where} ORDER BY ${sort} ${order} LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );
    const count = await this.pool.queryOne<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM resource_sources WHERE ${where}`,
      values
    );
    return { items: rows.map(rowToSource), total: count?.c ?? rows.length };
  }

  async count(workspaceId: UUID, query?: ResourceSourceQuery): Promise<number> {
    const r = await this.list(workspaceId, query, { limit: 1, offset: 0 });
    return r.total;
  }

  async create(workspaceId: UUID, input: ResourceSourceInput): Promise<ResourceSourceRow> {
    const row = await this.pool.queryOne<ResourceSourceRow>(
      `INSERT INTO resource_sources (
        workspace_id, name, url, resource_types, site_category, country, language,
        license_type, license, api_url, rss_url, requires_login, requires_api_key,
        supports_crawler, supports_downloader, provider_slug, crawl_frequency,
        status, enabled, notes, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb)
      RETURNING *`,
      [
        workspaceId,
        input.name,
        input.url ?? "",
        input.resource_types ?? [],
        input.site_category ?? "",
        input.country ?? "",
        input.language ?? "zh",
        input.license_type ?? "",
        input.license ?? "",
        input.api_url ?? "",
        input.rss_url ?? "",
        input.requires_login ?? false,
        input.requires_api_key ?? false,
        input.supports_crawler ?? true,
        input.supports_downloader ?? true,
        input.provider_slug ?? "generic-http",
        input.crawl_frequency ?? "manual",
        input.status ?? "active",
        input.enabled ?? true,
        input.notes ?? "",
        JSON.stringify(input.metadata ?? {}),
      ]
    );
    return rowToSource(row!);
  }

  async update(
    id: UUID,
    patch: Partial<ResourceSourceInput & { last_crawled_at?: string; last_updated_at?: string }>
  ): Promise<ResourceSourceRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const row = await this.pool.queryOne<ResourceSourceRow>(
      `UPDATE resource_sources SET
        name = COALESCE($2, name),
        url = COALESCE($3, url),
        resource_types = COALESCE($4, resource_types),
        site_category = COALESCE($5, site_category),
        country = COALESCE($6, country),
        language = COALESCE($7, language),
        license_type = COALESCE($8, license_type),
        license = COALESCE($9, license),
        api_url = COALESCE($10, api_url),
        rss_url = COALESCE($11, rss_url),
        requires_login = COALESCE($12, requires_login),
        requires_api_key = COALESCE($13, requires_api_key),
        supports_crawler = COALESCE($14, supports_crawler),
        supports_downloader = COALESCE($15, supports_downloader),
        provider_slug = COALESCE($16, provider_slug),
        crawl_frequency = COALESCE($17, crawl_frequency),
        status = COALESCE($18, status),
        enabled = COALESCE($19, enabled),
        notes = COALESCE($20, notes),
        metadata = COALESCE($21::jsonb, metadata),
        last_crawled_at = COALESCE($22, last_crawled_at),
        last_updated_at = COALESCE($23, last_updated_at),
        updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [
        id,
        patch.name ?? null,
        patch.url ?? null,
        patch.resource_types ?? null,
        patch.site_category ?? null,
        patch.country ?? null,
        patch.language ?? null,
        patch.license_type ?? null,
        patch.license ?? null,
        patch.api_url ?? null,
        patch.rss_url ?? null,
        patch.requires_login ?? null,
        patch.requires_api_key ?? null,
        patch.supports_crawler ?? null,
        patch.supports_downloader ?? null,
        patch.provider_slug ?? null,
        patch.crawl_frequency ?? null,
        patch.status ?? null,
        patch.enabled ?? null,
        patch.notes ?? null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.last_crawled_at ?? null,
        patch.last_updated_at ?? null,
      ]
    );
    return row ? rowToSource(row) : null;
  }

  async softDelete(id: UUID): Promise<boolean> {
    const r = await this.pool.query(
      `UPDATE resource_sources SET deleted_at = NOW(), enabled = FALSE WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return (r.rowCount ?? 0) > 0;
  }

  async stats(workspaceId: UUID) {
    const { rows } = await this.pool.query<{ site_category: string; cnt: number; enabled: boolean }>(
      `SELECT site_category, enabled, COUNT(*)::int AS cnt FROM resource_sources
       WHERE workspace_id = $1 AND deleted_at IS NULL GROUP BY site_category, enabled`,
      [workspaceId]
    );
    let total = 0;
    let enabled = 0;
    let disabled = 0;
    const byCategory: Record<string, number> = {};
    for (const r of rows) {
      total += r.cnt;
      if (r.enabled) enabled += r.cnt;
      else disabled += r.cnt;
      byCategory[r.site_category] = (byCategory[r.site_category] ?? 0) + r.cnt;
    }
    return { total, enabled, disabled, byCategory };
  }
}

export class PgCrawlerTaskRepository implements ICrawlerTaskRepository {
  constructor(private readonly pool: IPgPool) {}

  async findById(id: UUID): Promise<CrawlerTaskRow | null> {
    return this.pool.queryOne(`SELECT * FROM resource_crawler_tasks WHERE id = $1`, [id]);
  }

  async list(
    workspaceId: UUID,
    filters?: { source_id?: UUID; status?: TaskStatus },
    params?: PageParams
  ): Promise<PageResult<CrawlerTaskRow>> {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const cond = ["workspace_id = $1"];
    const vals: unknown[] = [workspaceId];
    let i = 2;
    if (filters?.source_id) {
      cond.push(`source_id = $${i++}`);
      vals.push(filters.source_id);
    }
    if (filters?.status) {
      cond.push(`status = $${i++}`);
      vals.push(filters.status);
    }
    const where = cond.join(" AND ");
    const { rows } = await this.pool.query<CrawlerTaskRow>(
      `SELECT * FROM resource_crawler_tasks WHERE ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset]
    );
    const c = await this.pool.queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM resource_crawler_tasks WHERE ${where}`,
      vals
    );
    return { items: rows, total: c?.n ?? rows.length };
  }

  async create(workspaceId: UUID, sourceId: UUID): Promise<CrawlerTaskRow> {
    const pos = await this.pool.queryOne<{ n: number }>(
      `SELECT COALESCE(MAX(queue_position), 0) + 1 AS n FROM resource_crawler_tasks WHERE status IN ('pending','running','paused')`
    );
    return (await this.pool.queryOne(
      `INSERT INTO resource_crawler_tasks (workspace_id, source_id, status, queue_position)
       VALUES ($1, $2, 'pending', $3) RETURNING *`,
      [workspaceId, sourceId, pos?.n ?? 1]
    ))!;
  }

  async updateStatus(
    id: UUID,
    status: TaskStatus,
    patch?: Partial<CrawlerTaskRow>
  ): Promise<CrawlerTaskRow | null> {
    return this.pool.queryOne(
      `UPDATE resource_crawler_tasks SET
        status = $2,
        progress = COALESCE($3::jsonb, progress),
        pages_total = COALESCE($4, pages_total),
        pages_done = COALESCE($5, pages_done),
        items_found = COALESCE($6, items_found),
        error_message = COALESCE($7, error_message),
        started_at = CASE WHEN $2 = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
        paused_at = CASE WHEN $2 = 'paused' THEN NOW() WHEN $2 = 'running' THEN NULL ELSE paused_at END,
        completed_at = CASE WHEN $2 IN ('completed','failed','cancelled') THEN NOW() ELSE completed_at END,
        updated_at = NOW()
      WHERE id = $1 RETURNING *`,
      [
        id,
        status,
        patch?.progress ? JSON.stringify(patch.progress) : null,
        patch?.pages_total ?? null,
        patch?.pages_done ?? null,
        patch?.items_found ?? null,
        patch?.error_message ?? null,
      ]
    );
  }

  async appendLog(taskId: UUID, level: string, message: string, payload?: Record<string, unknown>) {
    await this.pool.query(
      `INSERT INTO resource_crawler_logs (task_id, level, message, payload) VALUES ($1,$2,$3,$4::jsonb)`,
      [taskId, level, message, JSON.stringify(payload ?? {})]
    );
  }

  async listLogs(taskId: UUID, limit = 100): Promise<LogRow[]> {
    const { rows } = await this.pool.query<LogRow>(
      `SELECT * FROM resource_crawler_logs WHERE task_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [taskId, limit]
    );
    return rows;
  }

  async delete(id: UUID): Promise<boolean> {
    await this.pool.query(`DELETE FROM resource_crawler_logs WHERE task_id = $1`, [id]);
    const { rowCount } = await this.pool.query(`DELETE FROM resource_crawler_tasks WHERE id = $1`, [id]);
    return (rowCount ?? 0) > 0;
  }
}

export class PgDownloadTaskRepository implements IDownloadTaskRepository {
  constructor(private readonly pool: IPgPool) {}

  async findById(id: UUID): Promise<DownloadTaskRow | null> {
    return this.pool.queryOne(`SELECT * FROM resource_download_tasks WHERE id = $1`, [id]);
  }

  async list(
    workspaceId: UUID,
    filters?: { status?: TaskStatus; source_id?: UUID },
    params?: PageParams
  ): Promise<PageResult<DownloadTaskRow>> {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const cond = ["workspace_id = $1"];
    const vals: unknown[] = [workspaceId];
    let i = 2;
    if (filters?.status) {
      cond.push(`status = $${i++}`);
      vals.push(filters.status);
    }
    if (filters?.source_id) {
      cond.push(`source_id = $${i++}`);
      vals.push(filters.source_id);
    }
    const where = cond.join(" AND ");
    const { rows } = await this.pool.query<DownloadTaskRow>(
      `SELECT * FROM resource_download_tasks WHERE ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset]
    );
    const c = await this.pool.queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM resource_download_tasks WHERE ${where}`,
      vals
    );
    return { items: rows, total: c?.n ?? rows.length };
  }

  async create(
    input: Omit<
      DownloadTaskRow,
      | "id"
      | "created_at"
      | "updated_at"
      | "status"
      | "bytes_downloaded"
      | "retry_count"
      | "speed_bps"
      | "sha256_actual"
      | "error_message"
      | "started_at"
      | "paused_at"
      | "completed_at"
    > & { status?: TaskStatus }
  ): Promise<DownloadTaskRow> {
    return (await this.pool.queryOne(
      `INSERT INTO resource_download_tasks (
        workspace_id, source_id, crawler_task_id, remote_url, local_path, filename,
        status, bytes_total, sha256_expected, max_retries
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        input.workspace_id,
        input.source_id,
        input.crawler_task_id,
        input.remote_url,
        input.local_path,
        input.filename,
        input.status ?? "pending",
        input.bytes_total,
        input.sha256_expected,
        input.max_retries ?? 3,
      ]
    ))!;
  }

  async update(id: UUID, patch: Partial<DownloadTaskRow>): Promise<DownloadTaskRow | null> {
    return this.pool.queryOne(
      `UPDATE resource_download_tasks SET
        status = COALESCE($2, status),
        local_path = COALESCE($3, local_path),
        bytes_total = COALESCE($4, bytes_total),
        bytes_downloaded = COALESCE($5, bytes_downloaded),
        sha256_actual = COALESCE($6, sha256_actual),
        speed_bps = COALESCE($7, speed_bps),
        retry_count = COALESCE($8, retry_count),
        error_message = COALESCE($9, error_message),
        started_at = COALESCE($10, started_at),
        paused_at = COALESCE($11, paused_at),
        completed_at = COALESCE($12, completed_at),
        updated_at = NOW()
      WHERE id = $1 RETURNING *`,
      [
        id,
        patch.status ?? null,
        patch.local_path ?? null,
        patch.bytes_total ?? null,
        patch.bytes_downloaded ?? null,
        patch.sha256_actual ?? null,
        patch.speed_bps ?? null,
        patch.retry_count ?? null,
        patch.error_message ?? null,
        patch.started_at ?? null,
        patch.paused_at ?? null,
        patch.completed_at ?? null,
      ]
    );
  }

  async appendLog(taskId: UUID, level: string, message: string, payload?: Record<string, unknown>) {
    await this.pool.query(
      `INSERT INTO resource_download_logs (task_id, level, message, payload) VALUES ($1,$2,$3,$4::jsonb)`,
      [taskId, level, message, JSON.stringify(payload ?? {})]
    );
  }

  async listLogs(taskId: UUID, limit = 100): Promise<LogRow[]> {
    const { rows } = await this.pool.query<LogRow>(
      `SELECT * FROM resource_download_logs WHERE task_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [taskId, limit]
    );
    return rows;
  }
}

export function createResourceCenterRepositoryBundle(pool: IPgPool) {
  return {
    source: new PgResourceSourceRepository(pool),
    crawlerTask: new PgCrawlerTaskRepository(pool),
    downloadTask: new PgDownloadTaskRepository(pool),
  };
}
