import type {
  IRegistryRepository,
  IModelRepository,
  IProviderRepository,
  ICenterRepository,
  IAgentRepository,
  IWorkflowRepository,
  UUID,
} from "../interfaces";
import {
  LEGACY_AGENTS,
  LEGACY_ARTIFACT_KINDS,
  LEGACY_CENTERS,
  LEGACY_JOB_TYPES,
  LEGACY_MODELS,
  LEGACY_PROVIDERS,
  LEGACY_RESOURCE_TYPES,
  LEGACY_TEMPLATE_KINDS,
  LEGACY_WORKFLOWS,
} from "./registry-data";

export class LegacyModelRepository implements IModelRepository {
  async find(providerSlug: string, modelKey: string): Promise<unknown | null> {
    return (
      LEGACY_MODELS.find(
        (m) => m.provider_slug === providerSlug && m.model_key === modelKey
      ) ?? null
    );
  }

  async list(filters?: { modality?: string; providerSlug?: string }): Promise<unknown[]> {
    return LEGACY_MODELS.filter((m) => {
      if (filters?.modality && m.modality !== filters.modality) return false;
      if (filters?.providerSlug && m.provider_slug !== filters.providerSlug) return false;
      return true;
    });
  }
}

export class LegacyProviderRepository implements IProviderRepository {
  async findBySlug(slug: string): Promise<unknown | null> {
    return LEGACY_PROVIDERS.find((p) => p.slug === slug) ?? null;
  }

  async list(): Promise<unknown[]> {
    return [...LEGACY_PROVIDERS];
  }
}

export class LegacyCenterRepository implements ICenterRepository {
  async findBySlug(slug: string): Promise<unknown | null> {
    return LEGACY_CENTERS.find((c) => c.slug === slug) ?? null;
  }

  async list(): Promise<unknown[]> {
    return [...LEGACY_CENTERS];
  }

  async getState(_projectId: UUID, _centerSlug: string): Promise<unknown | null> {
    return null;
  }

  async upsertState(_projectId: UUID, _centerSlug: string, state: unknown): Promise<unknown> {
    return state;
  }
}

export class LegacyAgentRepository implements IAgentRepository {
  async findBySlug(slug: string): Promise<unknown | null> {
    return LEGACY_AGENTS.find((a) => a.slug === slug) ?? null;
  }

  async list(): Promise<unknown[]> {
    return [...LEGACY_AGENTS];
  }

  async getState(_projectId: UUID, _agentSlug: string): Promise<unknown | null> {
    return null;
  }
}

export class LegacyWorkflowRepository implements IWorkflowRepository {
  async findBySlug(slug: string): Promise<unknown | null> {
    return LEGACY_WORKFLOWS.find((w) => w.slug === slug) ?? null;
  }

  async list(): Promise<unknown[]> {
    return [...LEGACY_WORKFLOWS];
  }
}

export class LegacyRegistryRepository implements IRegistryRepository {
  constructor(
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
    return Promise.resolve(LEGACY_ARTIFACT_KINDS.find((k) => k.slug === slug) ?? null);
  }
  getResourceType(slug: string) {
    return Promise.resolve(LEGACY_RESOURCE_TYPES.find((r) => r.slug === slug) ?? null);
  }
  getTemplateKind(slug: string) {
    return Promise.resolve(LEGACY_TEMPLATE_KINDS.find((t) => t.slug === slug) ?? null);
  }
  getJobType(slug: string) {
    return Promise.resolve(LEGACY_JOB_TYPES.find((j) => j.slug === slug) ?? null);
  }
}

export function createLegacyRegistryRepositories() {
  const model = new LegacyModelRepository();
  const provider = new LegacyProviderRepository();
  const center = new LegacyCenterRepository();
  const agent = new LegacyAgentRepository();
  const workflow = new LegacyWorkflowRepository();
  const registry = new LegacyRegistryRepository(model, provider, center, agent, workflow);
  return { model, provider, center, agent, workflow, registry };
}
