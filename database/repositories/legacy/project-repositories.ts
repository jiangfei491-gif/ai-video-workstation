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
import { clientOnlyEmpty, clientOnlyNull } from "../shared/client-only-stub";

/** Workbench / Project 数据在浏览器 localStorage，Legacy 服务端不读写 */
export class LegacyProjectRepository implements IProjectRepository {
  async create(_input: unknown): Promise<unknown> {
    throw new Error("[Legacy] Project 存于 workbench localStorage，请使用客户端适配器");
  }
  async findById(_id: UUID): Promise<unknown | null> {
    return clientOnlyNull();
  }
  async update(_id: UUID, _patch: unknown): Promise<unknown> {
    throw new Error("[Legacy] Project 存于 workbench localStorage");
  }
  async softDelete(_id: UUID): Promise<void> {
    /* no-op */
  }
  async listByWorkspace(_workspaceId: UUID, _params?: PageParams): Promise<PageResult<unknown>> {
    return clientOnlyEmpty({ items: [], total: 0 });
  }
}

export class LegacyProjectSettingsRepository implements IProjectSettingsRepository {
  async get(_projectId: UUID): Promise<unknown | null> {
    return clientOnlyNull();
  }
  async upsert(_projectId: UUID, settings: unknown): Promise<unknown> {
    return settings;
  }
}

export class LegacyProjectShotRepository implements IProjectShotRepository {
  async listByProject(_projectId: UUID): Promise<unknown[]> {
    return [];
  }
  async upsertBatch(_projectId: UUID, shots: unknown[]): Promise<unknown[]> {
    return shots;
  }
}

export class LegacyWorkbenchSessionRepository implements IWorkbenchSessionRepository {
  async getByUserAndProject(_userId: UUID, _projectId: UUID): Promise<unknown | null> {
    return clientOnlyNull();
  }
  async upsert(session: unknown): Promise<unknown> {
    return session;
  }
}

export class LegacyArtifactRepository implements IArtifactRepository {
  async getOrCreate(_projectId: UUID, kind: string, slug?: string): Promise<unknown> {
    return { kind, slug: slug ?? kind };
  }
  async createVersion(_artifactId: UUID, payload: unknown, meta?: unknown): Promise<unknown> {
    return { payload, meta, version: 1 };
  }
  async listVersions(_artifactId: UUID): Promise<unknown[]> {
    return [];
  }
  async setActiveVersion(_artifactId: UUID, _versionId: UUID): Promise<void> {
    /* no-op */
  }
  async getActivePayload(_projectId: UUID, _kind: string): Promise<unknown | null> {
    return clientOnlyNull();
  }
}

export class LegacyTimelineRepository implements ITimelineRepository {
  async getActive(_projectId: UUID): Promise<unknown | null> {
    return clientOnlyNull();
  }
  async create(projectId: UUID, input?: unknown): Promise<unknown> {
    return { projectId, ...(input as object) };
  }
  async replaceClips(_timelineId: UUID, _clips: unknown[]): Promise<void> {
    /* no-op */
  }
  async replaceTransitions(_timelineId: UUID, _transitions: unknown[]): Promise<void> {
    /* no-op */
  }
  async projectFromArtifact(projectId: UUID, editGraphPayload: unknown): Promise<unknown> {
    return { projectId, editGraphPayload };
  }
}

export class LegacyDirectorRepository implements IDirectorRepository {
  async getState(_projectId: UUID): Promise<unknown | null> {
    return clientOnlyNull();
  }
  async upsertState(_projectId: UUID, state: unknown): Promise<unknown> {
    return state;
  }
  async getActivePlan(_projectId: UUID): Promise<unknown | null> {
    return clientOnlyNull();
  }
}

export class LegacyPromptRepository implements IPromptRepository {
  async create(input: unknown): Promise<unknown> {
    return input;
  }
  async listByProject(_projectId: UUID): Promise<unknown[]> {
    return [];
  }
}

export class LegacyTemplateRepository implements ITemplateRepository {
  async findByKindAndSlug(_workspaceId: UUID | null, _kind: string, _slug: string): Promise<unknown | null> {
    return clientOnlyNull();
  }
  async listByKind(_kind: string, _workspaceId?: UUID): Promise<unknown[]> {
    return [];
  }
}
