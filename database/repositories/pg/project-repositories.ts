import type { IPgPool } from "./pool";
import type {
  IProjectRepository,
  IProjectSettingsRepository,
  IProjectShotRepository,
  IWorkbenchSessionRepository,
  IArtifactRepository,
  ITimelineRepository,
  IDirectorRepository,
  IPromptRepository,
  ITemplateRepository,
  PageParams,
  PageResult,
  UUID,
} from "../interfaces";

export class PgProjectRepository implements IProjectRepository {
  constructor(private readonly pool: IPgPool) {}

  async create(input: unknown): Promise<unknown> {
    const i = input as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO projects (workspace_id, title, topic, pipeline_mode, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        i.workspace_id,
        i.title ?? "",
        i.topic ?? "",
        i.pipeline_mode ?? "t2v",
        i.status ?? "draft",
        i.created_by ?? null,
      ]
    );
  }

  async findById(id: UUID): Promise<unknown | null> {
    return this.pool.queryOne(
      "SELECT * FROM projects WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
  }

  async update(id: UUID, patch: unknown): Promise<unknown> {
    const p = patch as Record<string, unknown>;
    return this.pool.queryOne(
      `UPDATE projects SET
         title = COALESCE($2, title),
         topic = COALESCE($3, topic),
         status = COALESCE($4, status),
         updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, p.title ?? null, p.topic ?? null, p.status ?? null]
    );
  }

  async softDelete(id: UUID): Promise<void> {
    await this.pool.query("UPDATE projects SET deleted_at = NOW() WHERE id = $1", [id]);
  }

  async listByWorkspace(workspaceId: UUID, params?: PageParams): Promise<PageResult<unknown>> {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const { rows } = await this.pool.query(
      `SELECT * FROM projects WHERE workspace_id = $1 AND deleted_at IS NULL
       ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,
      [workspaceId, limit, offset]
    );
    const count = await this.pool.queryOne<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM projects WHERE workspace_id = $1 AND deleted_at IS NULL",
      [workspaceId]
    );
    return { items: rows, total: Number(count?.count ?? rows.length) };
  }
}

export class PgProjectSettingsRepository implements IProjectSettingsRepository {
  constructor(private readonly pool: IPgPool) {}

  async get(projectId: UUID): Promise<unknown | null> {
    return this.pool.queryOne("SELECT * FROM project_settings WHERE project_id = $1", [projectId]);
  }

  async upsert(projectId: UUID, settings: unknown): Promise<unknown> {
    const s = settings as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO project_settings (project_id, shot_count, aspect_ratio, clarity, edit_engine_settings)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (project_id) DO UPDATE SET
         shot_count = COALESCE(EXCLUDED.shot_count, project_settings.shot_count),
         aspect_ratio = COALESCE(EXCLUDED.aspect_ratio, project_settings.aspect_ratio),
         updated_at = NOW()
       RETURNING *`,
      [projectId, s.shot_count ?? 8, s.aspect_ratio ?? "9:16", s.clarity ?? "1080p", s.edit_engine_settings ?? {}]
    );
  }
}

export class PgProjectShotRepository implements IProjectShotRepository {
  constructor(private readonly pool: IPgPool) {}

  async listByProject(projectId: UUID): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM project_shots WHERE project_id = $1 ORDER BY shot_index",
      [projectId]
    );
    return rows;
  }

  async upsertBatch(projectId: UUID, shots: unknown[]): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const shot of shots) {
      const s = shot as Record<string, unknown>;
      const row = await this.pool.queryOne(
        `INSERT INTO project_shots (project_id, shot_index, label, metadata)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id, shot_index) DO UPDATE SET label = EXCLUDED.label, metadata = EXCLUDED.metadata
         RETURNING *`,
        [projectId, s.shot_index ?? 0, s.label ?? "", s.metadata ?? {}]
      );
      if (row) results.push(row);
    }
    return results;
  }
}

export class PgWorkbenchSessionRepository implements IWorkbenchSessionRepository {
  constructor(private readonly pool: IPgPool) {}

  async getByUserAndProject(userId: UUID, projectId: UUID): Promise<unknown | null> {
    return this.pool.queryOne(
      "SELECT * FROM workbench_sessions WHERE user_id = $1 AND project_id = $2",
      [userId, projectId]
    );
  }

  async upsert(session: unknown): Promise<unknown> {
    const s = session as Record<string, unknown>;
    const existing = await this.getByUserAndProject(s.user_id as UUID, s.project_id as UUID);
    if (existing && typeof existing === "object" && "id" in existing) {
      return this.pool.queryOne(
        `UPDATE workbench_sessions SET ui_state = $2, sync_version = $3, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [(existing as { id: UUID }).id, s.ui_state ?? {}, s.sync_version ?? 0]
      );
    }
    return this.pool.queryOne(
      `INSERT INTO workbench_sessions (user_id, project_id, ui_state, sync_version)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [s.user_id, s.project_id, s.ui_state ?? {}, s.sync_version ?? 0]
    );
  }
}

export class PgArtifactRepository implements IArtifactRepository {
  constructor(private readonly pool: IPgPool) {}

  async getOrCreate(projectId: UUID, kind: string, slug?: string): Promise<unknown> {
    const existing = await this.pool.queryOne(
      "SELECT * FROM project_artifacts WHERE project_id = $1 AND artifact_kind = $2 AND slug = $3",
      [projectId, kind, slug ?? "default"]
    );
    if (existing) return existing;
    return this.pool.queryOne(
      `INSERT INTO project_artifacts (project_id, artifact_kind, slug) VALUES ($1, $2, $3) RETURNING *`,
      [projectId, kind, slug ?? "default"]
    );
  }

  async createVersion(artifactId: UUID, payload: unknown, meta?: unknown): Promise<unknown> {
    const m = meta as Record<string, unknown> | undefined;
    const next = await this.pool.queryOne<{ v: number }>(
      "SELECT COALESCE(MAX(version), 0) + 1 AS v FROM artifact_versions WHERE artifact_id = $1",
      [artifactId]
    );
    const version = next?.v ?? 1;
    return this.pool.queryOne(
      `INSERT INTO artifact_versions (artifact_id, version, payload, summary, message, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [artifactId, version, payload, m ?? {}, m?.message ?? "", m?.created_by ?? null]
    );
  }

  async listVersions(artifactId: UUID): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM artifact_versions WHERE artifact_id = $1 ORDER BY version DESC",
      [artifactId]
    );
    return rows;
  }

  async setActiveVersion(artifactId: UUID, versionId: UUID): Promise<void> {
    await this.pool.query(
      "UPDATE project_artifacts SET active_version_id = $2, updated_at = NOW() WHERE id = $1",
      [artifactId, versionId]
    );
  }

  async getActivePayload(projectId: UUID, kind: string): Promise<unknown | null> {
    const artifact = await this.pool.queryOne<{ active_version_id: UUID }>(
      "SELECT active_version_id FROM project_artifacts WHERE project_id = $1 AND artifact_kind = $2 LIMIT 1",
      [projectId, kind]
    );
    if (!artifact?.active_version_id) return null;
    const version = await this.pool.queryOne(
      "SELECT payload FROM artifact_versions WHERE id = $1",
      [artifact.active_version_id]
    );
    return version;
  }
}

export class PgTimelineRepository implements ITimelineRepository {
  constructor(private readonly pool: IPgPool) {}

  async getActive(projectId: UUID): Promise<unknown | null> {
    return this.pool.queryOne(
      `SELECT t.* FROM timelines t
       JOIN projects p ON p.active_timeline_id = t.id
       WHERE p.id = $1`,
      [projectId]
    );
  }

  async create(projectId: UUID, input?: unknown): Promise<unknown> {
    const i = input as Record<string, unknown> | undefined;
    return this.pool.queryOne(
      `INSERT INTO timelines (project_id, label, artifact_version_id, metadata)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [projectId, i?.label ?? "main", i?.artifact_version_id ?? null, i?.metadata ?? {}]
    );
  }

  async replaceClips(timelineId: UUID, clips: unknown[]): Promise<void> {
    await this.pool.query("DELETE FROM timeline_clips WHERE timeline_id = $1", [timelineId]);
    for (const [idx, clip] of clips.entries()) {
      const c = clip as Record<string, unknown>;
      await this.pool.query(
        `INSERT INTO timeline_clips (timeline_id, project_id, track, sort_order, asset_id, start_sec, duration_sec, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          timelineId,
          c.project_id,
          c.track ?? "video",
          c.sort_order ?? idx,
          c.asset_id ?? null,
          c.start_sec ?? 0,
          c.duration_sec ?? 5,
          c.metadata ?? {},
        ]
      );
    }
  }

  async replaceTransitions(timelineId: UUID, transitions: unknown[]): Promise<void> {
    await this.pool.query("DELETE FROM timeline_transitions WHERE timeline_id = $1", [timelineId]);
    for (const tr of transitions) {
      const t = tr as Record<string, unknown>;
      await this.pool.query(
        `INSERT INTO timeline_transitions (timeline_id, after_clip_id, kind, duration_sec, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [timelineId, t.after_clip_id, t.kind ?? "cut", t.duration_sec ?? 0, t.metadata ?? {}]
      );
    }
  }

  async projectFromArtifact(projectId: UUID, editGraphPayload: unknown): Promise<unknown> {
    const timeline = await this.create(projectId, { label: "from-artifact" });
    return { timeline, editGraphPayload };
  }
}

export class PgDirectorRepository implements IDirectorRepository {
  constructor(private readonly pool: IPgPool) {}

  async getState(projectId: UUID): Promise<unknown | null> {
    return this.pool.queryOne(
      "SELECT * FROM project_director_state WHERE project_id = $1",
      [projectId]
    );
  }

  async upsertState(projectId: UUID, state: unknown): Promise<unknown> {
    const s = state as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO project_director_state (project_id, title, script, visual_settings)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id) DO UPDATE SET title = EXCLUDED.title, script = EXCLUDED.script, updated_at = NOW()
       RETURNING *`,
      [projectId, s.title ?? "", s.script ?? "", s.visual_settings ?? s.metadata ?? {}]
    );
  }

  async getActivePlan(projectId: UUID): Promise<unknown | null> {
    const artifact = await this.pool.queryOne<{ active_version_id: UUID }>(
      `SELECT pa.active_version_id FROM project_artifacts pa
       WHERE pa.project_id = $1 AND pa.artifact_kind = 'director_plan' LIMIT 1`,
      [projectId]
    );
    if (!artifact?.active_version_id) return null;
    return this.pool.queryOne("SELECT * FROM artifact_versions WHERE id = $1", [
      artifact.active_version_id,
    ]);
  }
}

export class PgPromptRepository implements IPromptRepository {
  constructor(private readonly pool: IPgPool) {}

  async create(input: unknown): Promise<unknown> {
    const i = input as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO provider_prompts (project_id, shot_index, provider_prompt, consistency_meta)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, shot_index) DO UPDATE SET provider_prompt = EXCLUDED.provider_prompt, updated_at = NOW()
       RETURNING *`,
      [
        i.project_id,
        i.shot_index ?? 0,
        i.provider_prompt ?? i.prompt_text ?? "",
        i.consistency_meta ?? i.metadata ?? {},
      ]
    );
  }

  async listByProject(projectId: UUID): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM provider_prompts WHERE project_id = $1 ORDER BY shot_index",
      [projectId]
    );
    return rows;
  }
}

export class PgTemplateRepository implements ITemplateRepository {
  constructor(private readonly pool: IPgPool) {}

  async findByKindAndSlug(workspaceId: UUID | null, kind: string, slug: string): Promise<unknown | null> {
    return this.pool.queryOne(
      `SELECT * FROM templates WHERE template_kind = $1 AND slug = $2
       AND (workspace_id = $3 OR workspace_id IS NULL) LIMIT 1`,
      [kind, slug, workspaceId]
    );
  }

  async listByKind(kind: string, workspaceId?: UUID): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM templates WHERE template_kind = $1
       AND ($2::uuid IS NULL OR workspace_id = $2 OR workspace_id IS NULL)
       ORDER BY slug`,
      [kind, workspaceId ?? null]
    );
    return rows;
  }
}
