import type { IPgPool } from "../pg/pool";
import type { UUID } from "../interfaces";
import {
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_SOURCE_SCHEDULE,
  type SchedulerGlobalConfig,
  type SourceScheduleConfig,
} from "@/app/lib/resource-center/phase2/scheduler/types";
import type {
  ISchedulerRepository,
  SchedulerConfigRow,
  SchedulerLogRow,
  SchedulerRunRow,
  SourceScheduleRow,
} from "./scheduler-interfaces";

function rowToConfig(r: SchedulerConfigRow): SchedulerConfigRow {
  return {
    ...r,
    config: { ...DEFAULT_SCHEDULER_CONFIG, ...(r.config as Partial<SchedulerGlobalConfig>) },
  };
}

function rowToSchedule(r: SourceScheduleRow): SourceScheduleRow {
  return {
    ...r,
    crawl_times: r.crawl_times ?? DEFAULT_SOURCE_SCHEDULE.crawlTimes,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  };
}

export class PgSchedulerRepository implements ISchedulerRepository {
  constructor(private readonly pool: IPgPool) {}

  async getConfig(workspaceId: UUID): Promise<SchedulerConfigRow | null> {
    const row = await this.pool.queryOne<SchedulerConfigRow>(
      `SELECT * FROM resource_scheduler_config WHERE workspace_id = $1`,
      [workspaceId]
    );
    return row ? rowToConfig(row) : null;
  }

  async upsertConfig(
    workspaceId: UUID,
    config: SchedulerGlobalConfig,
    paused?: boolean
  ): Promise<SchedulerConfigRow> {
    const row = await this.pool.queryOne<SchedulerConfigRow>(
      `INSERT INTO resource_scheduler_config (workspace_id, config, paused)
       VALUES ($1, $2::jsonb, COALESCE($3, FALSE))
       ON CONFLICT (workspace_id) DO UPDATE SET
         config = EXCLUDED.config,
         paused = COALESCE($3, resource_scheduler_config.paused),
         updated_at = NOW()
       RETURNING *`,
      [workspaceId, JSON.stringify(config), paused ?? null]
    );
    return rowToConfig(row!);
  }

  async setPaused(workspaceId: UUID, paused: boolean): Promise<void> {
    await this.pool.query(
      `INSERT INTO resource_scheduler_config (workspace_id, config, paused)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (workspace_id) DO UPDATE SET paused = $3, updated_at = NOW()`,
      [workspaceId, JSON.stringify(DEFAULT_SCHEDULER_CONFIG), paused]
    );
  }

  async getSourceSchedule(sourceId: UUID): Promise<SourceScheduleRow | null> {
    const row = await this.pool.queryOne<SourceScheduleRow>(
      `SELECT * FROM resource_source_schedules WHERE source_id = $1`,
      [sourceId]
    );
    return row ? rowToSchedule(row) : null;
  }

  async upsertSourceSchedule(
    workspaceId: UUID,
    sourceId: UUID,
    patch: Partial<SourceScheduleConfig> & {
      next_run_at?: string | null;
      last_run_at?: string | null;
      last_sync_at?: string | null;
      metadata?: Record<string, unknown>;
    }
  ): Promise<SourceScheduleRow> {
    const existing = await this.getSourceSchedule(sourceId);
    const base = existing ?? {
      enabled: DEFAULT_SOURCE_SCHEDULE.enabled,
      crawl_mode: DEFAULT_SOURCE_SCHEDULE.crawlMode,
      frequency: DEFAULT_SOURCE_SCHEDULE.frequency,
      custom_cron: DEFAULT_SOURCE_SCHEDULE.customCron,
      crawl_times: DEFAULT_SOURCE_SCHEDULE.crawlTimes,
      max_items: DEFAULT_SOURCE_SCHEDULE.maxItems,
      scan_mode: DEFAULT_SOURCE_SCHEDULE.scanMode,
      priority: DEFAULT_SOURCE_SCHEDULE.priority,
      next_run_at: null,
      last_run_at: null,
      last_sync_at: null,
      metadata: {},
    };

    const row = await this.pool.queryOne<SourceScheduleRow>(
      `INSERT INTO resource_source_schedules (
        workspace_id, source_id, enabled, crawl_mode, frequency, custom_cron,
        crawl_times, max_items, scan_mode, priority, next_run_at, last_run_at, last_sync_at, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
      ON CONFLICT (source_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        crawl_mode = EXCLUDED.crawl_mode,
        frequency = EXCLUDED.frequency,
        custom_cron = EXCLUDED.custom_cron,
        crawl_times = EXCLUDED.crawl_times,
        max_items = EXCLUDED.max_items,
        scan_mode = EXCLUDED.scan_mode,
        priority = EXCLUDED.priority,
        next_run_at = COALESCE(EXCLUDED.next_run_at, resource_source_schedules.next_run_at),
        last_run_at = COALESCE(EXCLUDED.last_run_at, resource_source_schedules.last_run_at),
        last_sync_at = COALESCE(EXCLUDED.last_sync_at, resource_source_schedules.last_sync_at),
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *`,
      [
        workspaceId,
        sourceId,
        patch.enabled ?? base.enabled ?? DEFAULT_SOURCE_SCHEDULE.enabled,
        patch.crawlMode ?? (base as SourceScheduleRow).crawl_mode ?? DEFAULT_SOURCE_SCHEDULE.crawlMode,
        patch.frequency ?? (base as SourceScheduleRow).frequency ?? DEFAULT_SOURCE_SCHEDULE.frequency,
        patch.customCron ?? (base as SourceScheduleRow).custom_cron ?? "",
        patch.crawlTimes ?? (base as SourceScheduleRow).crawl_times ?? DEFAULT_SOURCE_SCHEDULE.crawlTimes,
        patch.maxItems ?? (base as SourceScheduleRow).max_items ?? DEFAULT_SOURCE_SCHEDULE.maxItems,
        patch.scanMode ?? (base as SourceScheduleRow).scan_mode ?? DEFAULT_SOURCE_SCHEDULE.scanMode,
        patch.priority ?? (base as SourceScheduleRow).priority ?? DEFAULT_SOURCE_SCHEDULE.priority,
        patch.next_run_at !== undefined ? patch.next_run_at : (base as SourceScheduleRow).next_run_at,
        patch.last_run_at !== undefined ? patch.last_run_at : (base as SourceScheduleRow).last_run_at,
        patch.last_sync_at !== undefined ? patch.last_sync_at : (base as SourceScheduleRow).last_sync_at,
        JSON.stringify(patch.metadata ?? (base as SourceScheduleRow).metadata ?? {}),
      ]
    );
    return rowToSchedule(row!);
  }

  async listDueSchedules(workspaceId: UUID, before: Date): Promise<SourceScheduleRow[]> {
    const { rows } = await this.pool.query<SourceScheduleRow>(
      `SELECT * FROM resource_source_schedules
       WHERE workspace_id = $1 AND enabled = TRUE AND crawl_mode = 'auto'
         AND next_run_at IS NOT NULL AND next_run_at <= $2
       ORDER BY next_run_at ASC`,
      [workspaceId, before.toISOString()]
    );
    return rows.map(rowToSchedule);
  }

  async listAllSchedules(workspaceId: UUID): Promise<SourceScheduleRow[]> {
    const { rows } = await this.pool.query<SourceScheduleRow>(
      `SELECT * FROM resource_source_schedules WHERE workspace_id = $1 ORDER BY priority, source_id`,
      [workspaceId]
    );
    return rows.map(rowToSchedule);
  }

  async createRun(input: {
    workspace_id: UUID;
    source_id: UUID;
    trigger_type: string;
    crawler_task_id?: UUID | null;
  }): Promise<SchedulerRunRow> {
    return (await this.pool.queryOne(
      `INSERT INTO resource_scheduler_runs (workspace_id, source_id, trigger_type, crawler_task_id, status, started_at)
       VALUES ($1,$2,$3,$4,'running',NOW()) RETURNING *`,
      [input.workspace_id, input.source_id, input.trigger_type, input.crawler_task_id ?? null]
    ))!;
  }

  async updateRun(id: UUID, patch: Partial<SchedulerRunRow>): Promise<SchedulerRunRow | null> {
    return this.pool.queryOne(
      `UPDATE resource_scheduler_runs SET
        status = COALESCE($2, status),
        crawler_task_id = COALESCE($3, crawler_task_id),
        items_found = COALESCE($4, items_found),
        items_failed = COALESCE($5, items_failed),
        error_message = COALESCE($6, error_message),
        completed_at = COALESCE($7, completed_at)
      WHERE id = $1 RETURNING *`,
      [
        id,
        patch.status ?? null,
        patch.crawler_task_id ?? null,
        patch.items_found ?? null,
        patch.items_failed ?? null,
        patch.error_message ?? null,
        patch.completed_at ?? null,
      ]
    );
  }

  async listRecentRuns(workspaceId: UUID, limit = 50): Promise<SchedulerRunRow[]> {
    const { rows } = await this.pool.query<SchedulerRunRow>(
      `SELECT * FROM resource_scheduler_runs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [workspaceId, limit]
    );
    return rows;
  }

  async appendLog(
    workspaceId: UUID,
    level: string,
    message: string,
    payload?: Record<string, unknown>
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO resource_scheduler_logs (workspace_id, level, message, payload) VALUES ($1,$2,$3,$4::jsonb)`,
      [workspaceId, level, message, JSON.stringify(payload ?? {})]
    );
  }

  async listLogs(workspaceId: UUID, limit = 100): Promise<SchedulerLogRow[]> {
    const { rows } = await this.pool.query<SchedulerLogRow>(
      `SELECT * FROM resource_scheduler_logs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [workspaceId, limit]
    );
    return rows.map((r) => ({ ...r, payload: (r.payload as Record<string, unknown>) ?? {} }));
  }

  async purgeLogs(workspaceId: UUID, before: Date): Promise<number> {
    const row = await this.pool.queryOne<{ n: number }>(
      `WITH d AS (
         DELETE FROM resource_scheduler_logs WHERE workspace_id = $1 AND created_at < $2 RETURNING 1
       ) SELECT COUNT(*)::int AS n FROM d`,
      [workspaceId, before.toISOString()]
    );
    return row?.n ?? 0;
  }
}

export function createSchedulerRepositoryBundle(pool: IPgPool) {
  return { scheduler: new PgSchedulerRepository(pool) };
}
