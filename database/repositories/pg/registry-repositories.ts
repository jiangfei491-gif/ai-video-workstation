import type { IPgPool } from "./pool";
import type {
  IRegistryRepository,
  IModelRepository,
  IProviderRepository,
  ICenterRepository,
  IAgentRepository,
  IWorkflowRepository,
  UUID,
} from "../interfaces";

export class PgModelRepository implements IModelRepository {
  constructor(private readonly pool: IPgPool) {}

  async find(providerSlug: string, modelKey: string): Promise<unknown | null> {
    return this.pool.queryOne(
      "SELECT * FROM model_registry WHERE provider_slug = $1 AND model_key = $2",
      [providerSlug, modelKey]
    );
  }

  async list(filters?: { modality?: string; providerSlug?: string }): Promise<unknown[]> {
    const clauses: string[] = ["is_active = TRUE"];
    const params: unknown[] = [];
    if (filters?.modality) {
      params.push(filters.modality);
      clauses.push(`modality = $${params.length}`);
    }
    if (filters?.providerSlug) {
      params.push(filters.providerSlug);
      clauses.push(`provider_slug = $${params.length}`);
    }
    const { rows } = await this.pool.query(
      `SELECT * FROM model_registry WHERE ${clauses.join(" AND ")} ORDER BY provider_slug, model_key`,
      params
    );
    return rows;
  }
}

export class PgProviderRepository implements IProviderRepository {
  constructor(private readonly pool: IPgPool) {}

  async findBySlug(slug: string): Promise<unknown | null> {
    return this.pool.queryOne("SELECT * FROM provider_registry WHERE slug = $1", [slug]);
  }

  async list(): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM provider_registry WHERE is_enabled = TRUE ORDER BY priority DESC, slug"
    );
    return rows;
  }
}

export class PgCenterRepository implements ICenterRepository {
  constructor(private readonly pool: IPgPool) {}

  async findBySlug(slug: string): Promise<unknown | null> {
    return this.pool.queryOne("SELECT * FROM center_registry WHERE slug = $1", [slug]);
  }

  async list(): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM center_registry WHERE is_enabled = TRUE ORDER BY slug"
    );
    return rows;
  }

  async getState(projectId: UUID, centerSlug: string): Promise<unknown | null> {
    return this.pool.queryOne(
      "SELECT * FROM center_states WHERE project_id = $1 AND center_slug = $2",
      [projectId, centerSlug]
    );
  }

  async upsertState(projectId: UUID, centerSlug: string, state: unknown): Promise<unknown> {
    const s = state as Record<string, unknown>;
    return this.pool.queryOne(
      `INSERT INTO center_states (project_id, center_slug, state, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (project_id, center_slug) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
       RETURNING *`,
      [projectId, centerSlug, s.state ?? s]
    );
  }
}

export class PgAgentRepository implements IAgentRepository {
  constructor(private readonly pool: IPgPool) {}

  async findBySlug(slug: string): Promise<unknown | null> {
    return this.pool.queryOne("SELECT * FROM agent_registry WHERE slug = $1", [slug]);
  }

  async list(): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM agent_registry WHERE is_enabled = TRUE ORDER BY slug"
    );
    return rows;
  }

  async getState(projectId: UUID, agentSlug: string): Promise<unknown | null> {
    return this.pool.queryOne(
      "SELECT * FROM agent_states WHERE project_id = $1 AND agent_slug = $2",
      [projectId, agentSlug]
    );
  }
}

export class PgWorkflowRepository implements IWorkflowRepository {
  constructor(private readonly pool: IPgPool) {}

  async findBySlug(slug: string): Promise<unknown | null> {
    return this.pool.queryOne(
      "SELECT * FROM workflow_registry WHERE slug = $1 AND is_active = TRUE ORDER BY version DESC LIMIT 1",
      [slug]
    );
  }

  async list(): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM workflow_registry WHERE is_active = TRUE ORDER BY slug"
    );
    return rows;
  }
}

export class PgRegistryRepository implements IRegistryRepository {
  constructor(
    private readonly pool: IPgPool,
    private readonly model: IModelRepository,
    private readonly provider: IProviderRepository,
    private readonly center: ICenterRepository,
    private readonly agent: IAgentRepository,
    private readonly workflow: IWorkflowRepository
  ) {}

  getAgent(slug: string) {
    return this.agent.findBySlug(slug);
  }
  listAgents() {
    return this.agent.list();
  }
  getCenter(slug: string) {
    return this.center.findBySlug(slug);
  }
  listCenters() {
    return this.center.list();
  }
  getProvider(slug: string) {
    return this.provider.findBySlug(slug);
  }
  getModel(providerSlug: string, modelKey: string) {
    return this.model.find(providerSlug, modelKey);
  }
  listModels(filters?: { modality?: string; providerSlug?: string }) {
    return this.model.list(filters);
  }
  getWorkflow(slug: string) {
    return this.workflow.findBySlug(slug);
  }
  getArtifactKind(slug: string) {
    return this.pool.queryOne("SELECT * FROM artifact_registry WHERE slug = $1", [slug]);
  }
  getResourceType(slug: string) {
    return this.pool.queryOne("SELECT * FROM resource_registry WHERE slug = $1", [slug]);
  }
  getTemplateKind(slug: string) {
    return this.pool.queryOne("SELECT * FROM template_registry WHERE slug = $1", [slug]);
  }
  getJobType(slug: string) {
    return this.pool.queryOne("SELECT * FROM job_registry WHERE slug = $1", [slug]);
  }
}

export function createPgRegistryRepositories(pool: IPgPool) {
  const model = new PgModelRepository(pool);
  const provider = new PgProviderRepository(pool);
  const center = new PgCenterRepository(pool);
  const agent = new PgAgentRepository(pool);
  const workflow = new PgWorkflowRepository(pool);
  const registry = new PgRegistryRepository(pool, model, provider, center, agent, workflow);
  return { model, provider, center, agent, workflow, registry };
}
