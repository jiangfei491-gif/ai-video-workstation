/**
 * AI Cut V1 — Repository 层契约
 *
 * 规则（强制）：
 * - 业务代码（app/api、app/lib、Center、Agent）禁止直接访问 PostgreSQL
 * - 仅 database/repositories 实现类可执行 SQL
 * - 第二阶段接入时，通过 RepositoryFactory 注入
 *
 * 本文件仅定义接口，不含实现、不含业务逻辑。
 */

export type UUID = string;

export interface PageParams {
  limit?: number;
  offset?: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface IUserRepository {
  findById(id: UUID): Promise<unknown | null>;
  findByEmail(email: string): Promise<unknown | null>;
}

export interface IWorkspaceRepository {
  findById(id: UUID): Promise<unknown | null>;
  findBySlug(slug: string): Promise<unknown | null>;
  listMembers(workspaceId: UUID): Promise<unknown[]>;
}

// ---------------------------------------------------------------------------
// Registry（只读为主，管理后台可写）
// ---------------------------------------------------------------------------

export interface IRegistryRepository {
  getAgent(slug: string): Promise<unknown | null>;
  listAgents(): Promise<unknown[]>;
  getCenter(slug: string): Promise<unknown | null>;
  listCenters(): Promise<unknown[]>;
  getProvider(slug: string): Promise<unknown | null>;
  getModel(providerSlug: string, modelKey: string): Promise<unknown | null>;
  listModels(filters?: { modality?: string; providerSlug?: string }): Promise<unknown[]>;
  getWorkflow(slug: string): Promise<unknown | null>;
  getArtifactKind(slug: string): Promise<unknown | null>;
  getResourceType(slug: string): Promise<unknown | null>;
  getTemplateKind(slug: string): Promise<unknown | null>;
  getJobType(slug: string): Promise<unknown | null>;
}

// ---------------------------------------------------------------------------
// Project（核心）
// ---------------------------------------------------------------------------

export interface IProjectRepository {
  create(input: unknown): Promise<unknown>;
  findById(id: UUID): Promise<unknown | null>;
  update(id: UUID, patch: unknown): Promise<unknown>;
  softDelete(id: UUID): Promise<void>;
  listByWorkspace(workspaceId: UUID, params?: PageParams): Promise<PageResult<unknown>>;
}

export interface IProjectSettingsRepository {
  get(projectId: UUID): Promise<unknown | null>;
  upsert(projectId: UUID, settings: unknown): Promise<unknown>;
}

export interface IProjectShotRepository {
  listByProject(projectId: UUID): Promise<unknown[]>;
  upsertBatch(projectId: UUID, shots: unknown[]): Promise<unknown[]>;
}

export interface IWorkbenchSessionRepository {
  getByUserAndProject(userId: UUID, projectId: UUID): Promise<unknown | null>;
  upsert(session: unknown): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Artifact 版本（Director Plan / EditGraph / ClipIntent）
// ---------------------------------------------------------------------------

export interface IArtifactRepository {
  getOrCreate(projectId: UUID, kind: string, slug?: string): Promise<unknown>;
  createVersion(artifactId: UUID, payload: unknown, meta?: unknown): Promise<unknown>;
  listVersions(artifactId: UUID): Promise<unknown[]>;
  setActiveVersion(artifactId: UUID, versionId: UUID): Promise<void>;
  getActivePayload(projectId: UUID, kind: string): Promise<unknown | null>;
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export interface IMaterialRepository {
  findById(id: UUID): Promise<unknown | null>;
  listByWorkspace(workspaceId: UUID, params?: PageParams): Promise<PageResult<unknown>>;
  create(input: unknown): Promise<unknown>;
  update(id: UUID, patch: unknown): Promise<unknown>;
}

export interface ICharacterRepository {
  findById(id: UUID): Promise<unknown | null>;
  listByWorkspace(workspaceId: UUID): Promise<unknown[]>;
  create(input: unknown): Promise<unknown>;
}

export interface ISceneRepository {
  findById(id: UUID): Promise<unknown | null>;
  listByWorkspace(workspaceId: UUID): Promise<unknown[]>;
  create(input: unknown): Promise<unknown>;
}

export interface IPropRepository {
  findById(id: UUID): Promise<unknown | null>;
  listByWorkspace(workspaceId: UUID): Promise<unknown[]>;
  create(input: unknown): Promise<unknown>;
}

export interface ITemplateRepository {
  findByKindAndSlug(workspaceId: UUID | null, kind: string, slug: string): Promise<unknown | null>;
  listByKind(kind: string, workspaceId?: UUID): Promise<unknown[]>;
}

export interface IPromptRepository {
  create(input: unknown): Promise<unknown>;
  listByProject(projectId: UUID): Promise<unknown[]>;
}

// ---------------------------------------------------------------------------
// Asset（统一媒体）
// ---------------------------------------------------------------------------

export interface IAssetRepository {
  create(input: unknown): Promise<unknown>;
  findById(id: UUID): Promise<unknown | null>;
  findByStorageKey(bucket: string, key: string): Promise<unknown | null>;
  listByProject(projectId: UUID, kind?: string): Promise<unknown[]>;
  linkToProject(projectId: UUID, assetId: UUID, meta: unknown): Promise<void>;
  linkToShot(projectId: UUID, shotIndex: number, assetId: UUID, role: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export interface ITimelineRepository {
  getActive(projectId: UUID): Promise<unknown | null>;
  create(projectId: UUID, input?: unknown): Promise<unknown>;
  replaceClips(timelineId: UUID, clips: unknown[]): Promise<void>;
  replaceTransitions(timelineId: UUID, transitions: unknown[]): Promise<void>;
  projectFromArtifact(projectId: UUID, editGraphPayload: unknown): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface IJobRepository {
  create(input: unknown): Promise<unknown>;
  findById(id: UUID): Promise<unknown | null>;
  updateStatus(id: UUID, patch: unknown): Promise<unknown>;
  appendStep(jobId: UUID, step: unknown): Promise<unknown>;
  listByProject(projectId: UUID, params?: PageParams): Promise<PageResult<unknown>>;
}

export interface IWorkflowRunRepository {
  start(projectId: UUID, workflowSlug: string, jobId?: UUID): Promise<unknown>;
  appendLog(runId: UUID, entry: unknown): Promise<void>;
  complete(runId: UUID, status: string): Promise<void>;
}

export interface IClipAgentRepository {
  createRun(input: unknown): Promise<unknown>;
  appendCommands(runId: UUID, commands: unknown[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// QA / Export / Cost / Logs
// ---------------------------------------------------------------------------

export interface IQaRepository {
  saveReport(report: unknown): Promise<unknown>;
  listByProject(projectId: UUID): Promise<unknown[]>;
  appendLog(entry: unknown): Promise<void>;
}

export interface IExportRepository {
  create(record: unknown): Promise<unknown>;
  listByProject(projectId: UUID): Promise<unknown[]>;
}

export interface ICostRepository {
  append(entry: unknown): Promise<unknown>;
  sumByProject(projectId: UUID): Promise<unknown>;
}

export interface IActivityLogRepository {
  append(entry: unknown): Promise<unknown>;
  list(params: unknown): Promise<unknown[]>;
}

export interface ICenterLogRepository {
  append(entry: unknown): Promise<void>;
  listByProject(projectId: UUID, centerSlug: string): Promise<unknown[]>;
}

export interface IAgentLogRepository {
  append(entry: unknown): Promise<void>;
  listByProject(projectId: UUID, agentSlug: string): Promise<unknown[]>;
}

export interface IWorkflowRepository {
  findBySlug(slug: string): Promise<unknown | null>;
  list(): Promise<unknown[]>;
}

// ---------------------------------------------------------------------------
// Director / Center 领域 Repository（P1）
// ---------------------------------------------------------------------------

export interface IDirectorRepository {
  getState(projectId: UUID): Promise<unknown | null>;
  upsertState(projectId: UUID, state: unknown): Promise<unknown>;
  getActivePlan(projectId: UUID): Promise<unknown | null>;
}

export interface IVoiceRepository {
  getCenterState(projectId: UUID): Promise<unknown | null>;
  listVoicePresets(workspaceId?: UUID): Promise<unknown[]>;
}

export interface ISubtitleRepository {
  getCenterState(projectId: UUID): Promise<unknown | null>;
  listStyles(workspaceId?: UUID): Promise<unknown[]>;
}

export interface IMusicRepository {
  getCenterState(projectId: UUID): Promise<unknown | null>;
  listTracks(workspaceId?: UUID): Promise<unknown[]>;
}

export interface IEffectRepository {
  getCenterState(projectId: UUID): Promise<unknown | null>;
  listPresets(workspaceId?: UUID): Promise<unknown[]>;
}

export interface IModelRepository {
  find(providerSlug: string, modelKey: string): Promise<unknown | null>;
  list(filters?: { modality?: string; providerSlug?: string }): Promise<unknown[]>;
}

export interface IProviderRepository {
  findBySlug(slug: string): Promise<unknown | null>;
  list(): Promise<unknown[]>;
}

export interface ICenterRepository {
  findBySlug(slug: string): Promise<unknown | null>;
  list(): Promise<unknown[]>;
  getState(projectId: UUID, centerSlug: string): Promise<unknown | null>;
  upsertState(projectId: UUID, centerSlug: string, state: unknown): Promise<unknown>;
}

export interface IAgentRepository {
  findBySlug(slug: string): Promise<unknown | null>;
  list(): Promise<unknown[]>;
  getState(projectId: UUID, agentSlug: string): Promise<unknown | null>;
}

// ---------------------------------------------------------------------------
// Legacy JSON 兼容层
// ---------------------------------------------------------------------------

export interface ILegacyJsonAdapter {
  /** 从现有 JSON 文件只读加载，不写 DB */
  readMaterials(): Promise<unknown[]>;
  readCharacters(): Promise<unknown[]>;
  readScenes(): Promise<unknown[]>;
  readProps(): Promise<unknown[]>;
  readImageAssets(): Promise<unknown[]>;
  readShotLocks(): Promise<unknown[]>;
  readEditJobs(): Promise<unknown[]>;
  /** legacy id → UUID 映射 */
  mapLegacyKey(source: string, legacyKey: string, entityType: string, entityId: UUID): Promise<void>;
}

// ---------------------------------------------------------------------------
// Factory（第二阶段实现）
// ---------------------------------------------------------------------------

export interface RepositoryBundle {
  user: IUserRepository;
  workspace: IWorkspaceRepository;
  registry: IRegistryRepository;
  project: IProjectRepository;
  projectSettings: IProjectSettingsRepository;
  projectShot: IProjectShotRepository;
  workbenchSession: IWorkbenchSessionRepository;
  artifact: IArtifactRepository;
  material: IMaterialRepository;
  character: ICharacterRepository;
  scene: ISceneRepository;
  prop: IPropRepository;
  template: ITemplateRepository;
  prompt: IPromptRepository;
  asset: IAssetRepository;
  timeline: ITimelineRepository;
  director: IDirectorRepository;
  job: IJobRepository;
  workflowRun: IWorkflowRunRepository;
  clipAgent: IClipAgentRepository;
  qa: IQaRepository;
  voice: IVoiceRepository;
  subtitle: ISubtitleRepository;
  music: IMusicRepository;
  effect: IEffectRepository;
  export: IExportRepository;
  cost: ICostRepository;
  activityLog: IActivityLogRepository;
  centerLog: ICenterLogRepository;
  agentLog: IAgentLogRepository;
  model: IModelRepository;
  provider: IProviderRepository;
  center: ICenterRepository;
  agent: IAgentRepository;
  workflow: IWorkflowRepository;
  legacyJson: ILegacyJsonAdapter;
}

/** P1：createRepositoryBundle — 见 factory.ts */
