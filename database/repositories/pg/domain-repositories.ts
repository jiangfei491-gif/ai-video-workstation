import type { IPgPool } from "./pool";
import type {
  IVoiceRepository,
  ISubtitleRepository,
  IMusicRepository,
  IEffectRepository,
  IQaRepository,
  IExportRepository,
  ICostRepository,
  IWorkflowRunRepository,
  IClipAgentRepository,
  IActivityLogRepository,
  ICenterLogRepository,
  IAgentLogRepository,
  UUID,
} from "../interfaces";

export class PgVoiceRepository implements IVoiceRepository {
  constructor(private readonly pool: IPgPool) {}

  async getCenterState(projectId: UUID): Promise<unknown | null> {
    return this.pool.queryOne(
      "SELECT * FROM center_states WHERE project_id = $1 AND center_slug = 'voice-center'",
      [projectId]
    );
  }

  async listVoicePresets(workspaceId?: UUID): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM voice_library WHERE ($1::uuid IS NULL OR workspace_id = $1 OR workspace_id IS NULL)`,
      [workspaceId ?? null]
    );
    return rows;
  }
}

export class PgSubtitleRepository implements ISubtitleRepository {
  constructor(private readonly pool: IPgPool) {}

  async getCenterState(projectId: UUID): Promise<unknown | null> {
    return this.pool.queryOne(
      "SELECT * FROM center_states WHERE project_id = $1 AND center_slug = 'subtitle-center'",
      [projectId]
    );
  }

  async listStyles(workspaceId?: UUID): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM subtitle_library WHERE ($1::uuid IS NULL OR workspace_id = $1 OR workspace_id IS NULL)`,
      [workspaceId ?? null]
    );
    return rows;
  }
}

export class PgMusicRepository implements IMusicRepository {
  constructor(private readonly pool: IPgPool) {}

  async getCenterState(projectId: UUID): Promise<unknown | null> {
    return this.pool.queryOne(
      "SELECT * FROM center_states WHERE project_id = $1 AND center_slug = 'music-center'",
      [projectId]
    );
  }

  async listTracks(workspaceId?: UUID): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM music_library WHERE ($1::uuid IS NULL OR workspace_id = $1 OR workspace_id IS NULL)`,
      [workspaceId ?? null]
    );
    return rows;
  }
}

export class PgEffectRepository implements IEffectRepository {
  constructor(private readonly pool: IPgPool) {}

  async getCenterState(projectId: UUID): Promise<unknown | null> {
    return this.pool.queryOne(
      "SELECT * FROM center_states WHERE project_id = $1 AND center_slug = 'effect-center'",
      [projectId]
    );
  }

  async listPresets(workspaceId?: UUID): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM effects_library WHERE ($1::uuid IS NULL OR workspace_id = $1 OR workspace_id IS NULL)`,
      [workspaceId ?? null]
    );
    return rows;
  }
}

export class PgQaRepository implements IQaRepository {
  constructor(private readonly pool: IPgPool) {}

  async saveReport(report: unknown): Promise<unknown> {
    const r = report as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO qa_reports (project_id, job_id, overall_score, score_breakdown, approved, report_markdown)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        r.project_id,
        r.job_id ?? null,
        r.overall_score ?? r.score ?? 0,
        r.score_breakdown ?? {},
        r.approved ?? null,
        r.report_markdown ?? "",
      ]
    );
  }

  async listByProject(projectId: UUID): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM qa_reports WHERE project_id = $1 ORDER BY created_at DESC",
      [projectId]
    );
    return rows;
  }

  async appendLog(entry: unknown): Promise<void> {
    const e = entry as Record<string, unknown>;
    await this.pool.query(
      `INSERT INTO qa_logs (project_id, qa_report_id, level, message, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [e.project_id, e.qa_report_id ?? null, e.level ?? "info", e.message ?? "", e.payload ?? e.metadata ?? {}]
    );
  }
}

export class PgExportRepository implements IExportRepository {
  constructor(private readonly pool: IPgPool) {}

  async create(record: unknown): Promise<unknown> {
    const r = record as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO export_records (project_id, job_id, export_type, asset_id, settings, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        r.project_id,
        r.job_id ?? null,
        r.export_type ?? r.format ?? "mp4",
        r.asset_id ?? null,
        r.settings ?? r.metadata ?? {},
        r.status ?? "pending",
      ]
    );
  }

  async listByProject(projectId: UUID): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM export_records WHERE project_id = $1 ORDER BY created_at DESC",
      [projectId]
    );
    return rows;
  }
}

export class PgCostRepository implements ICostRepository {
  constructor(private readonly pool: IPgPool) {}

  async append(entry: unknown): Promise<unknown> {
    const e = entry as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO cost_ledger (workspace_id, project_id, job_id, category, provider_slug, model_slug, input_tokens, output_tokens, cost_usd, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        e.workspace_id,
        e.project_id ?? null,
        e.job_id ?? null,
        e.category ?? "api",
        e.provider_slug ?? "",
        e.model_slug ?? e.model_key ?? "",
        e.input_tokens ?? e.tokens ?? 0,
        e.output_tokens ?? 0,
        e.cost_usd ?? e.amount_usd ?? 0,
        e.metadata ?? {},
      ]
    );
  }

  async sumByProject(projectId: UUID): Promise<unknown> {
    return this.pool.queryOne(
      `SELECT project_id, SUM(cost_usd) AS total_usd, SUM(input_tokens + output_tokens) AS total_tokens
       FROM cost_ledger WHERE project_id = $1 GROUP BY project_id`,
      [projectId]
    );
  }
}

export class PgWorkflowRunRepository implements IWorkflowRunRepository {
  constructor(private readonly pool: IPgPool) {}

  async start(projectId: UUID, workflowSlug: string, jobId?: UUID): Promise<unknown> {
    return this.pool.queryOne(
      `INSERT INTO workflow_runs (project_id, workflow_slug, job_id, status)
       VALUES ($1, $2, $3, 'running') RETURNING *`,
      [projectId, workflowSlug, jobId ?? null]
    );
  }

  async appendLog(runId: UUID, entry: unknown): Promise<void> {
    const e = entry as Record<string, unknown>;
    await this.pool.query(
      `INSERT INTO workflow_run_logs (workflow_run_id, node_key, event, message, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [runId, e.node_key ?? "", e.event ?? e.level ?? "info", e.message ?? "", e.payload ?? e.metadata ?? {}]
    );
  }

  async complete(runId: UUID, status: string): Promise<void> {
    await this.pool.query(
      "UPDATE workflow_runs SET status = $2, completed_at = NOW() WHERE id = $1",
      [runId, status]
    );
  }
}

export class PgClipAgentRepository implements IClipAgentRepository {
  constructor(private readonly pool: IPgPool) {}

  async createRun(input: unknown): Promise<unknown> {
    const i = input as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO clip_agent_runs (project_id, job_id, status, trace)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [i.project_id, i.job_id ?? null, i.status ?? "pending", i.trace ?? i.metadata ?? {}]
    );
  }

  async appendCommands(runId: UUID, commands: unknown[]): Promise<void> {
    for (const [idx, cmd] of commands.entries()) {
      const c = cmd as Record<string, unknown>;
      await this.pool.query(
        `INSERT INTO clip_agent_commands (clip_agent_run_id, seq, command_type, payload)
         VALUES ($1, $2, $3, $4)`,
        [runId, idx, c.command_type ?? "unknown", c.payload ?? c]
      );
    }
  }
}

export class PgActivityLogRepository implements IActivityLogRepository {
  constructor(private readonly pool: IPgPool) {}

  async append(entry: unknown): Promise<unknown> {
    const e = entry as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO activity_logs (workspace_id, project_id, user_id, module, action, status, message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        e.workspace_id,
        e.project_id ?? null,
        e.user_id ?? null,
        e.module ?? e.event_type ?? "",
        e.action ?? "",
        e.status ?? "running",
        e.message ?? "",
        e.metadata ?? {},
      ]
    );
  }

  async list(params: unknown): Promise<unknown[]> {
    const p = params as Record<string, unknown>;
    const { rows } = await this.pool.query(
      `SELECT * FROM activity_logs WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [p.project_id ?? null, p.limit ?? 50]
    );
    return rows;
  }
}

export class PgCenterLogRepository implements ICenterLogRepository {
  constructor(private readonly pool: IPgPool) {}

  async append(entry: unknown): Promise<void> {
    const e = entry as Record<string, unknown>;
    await this.pool.query(
      `INSERT INTO center_logs (project_id, center_slug, level, message, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [e.project_id, e.center_slug ?? "", e.level ?? "info", e.message ?? "", e.payload ?? e.metadata ?? {}]
    );
  }

  async listByProject(projectId: UUID, centerSlug: string): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM center_logs WHERE project_id = $1 AND center_slug = $2 ORDER BY created_at DESC",
      [projectId, centerSlug]
    );
    return rows;
  }
}

export class PgAgentLogRepository implements IAgentLogRepository {
  constructor(private readonly pool: IPgPool) {}

  async append(entry: unknown): Promise<void> {
    const e = entry as Record<string, unknown>;
    await this.pool.query(
      `INSERT INTO agent_logs (project_id, agent_slug, level, event, message, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        e.project_id,
        e.agent_slug ?? "",
        e.level ?? "info",
        e.event ?? "",
        e.message ?? "",
        e.payload ?? e.metadata ?? {},
      ]
    );
  }

  async listByProject(projectId: UUID, agentSlug: string): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM agent_logs WHERE project_id = $1 AND agent_slug = $2 ORDER BY created_at DESC",
      [projectId, agentSlug]
    );
    return rows;
  }
}
