import type { RepositoryBundle } from "../interfaces";
import type { IPgPool } from "./pool";
import { PgAssetRepository, PgJobRepository } from "./asset-job-repositories";
import {
  PgActivityLogRepository,
  PgAgentLogRepository,
  PgCenterLogRepository,
  PgClipAgentRepository,
  PgCostRepository,
  PgEffectRepository,
  PgExportRepository,
  PgMusicRepository,
  PgQaRepository,
  PgSubtitleRepository,
  PgVoiceRepository,
  PgWorkflowRunRepository,
} from "./domain-repositories";
import { PgUserRepository, PgWorkspaceRepository } from "./identity-repositories";
import {
  PgCharacterRepository,
  PgMaterialRepository,
  PgPropRepository,
  PgSceneRepository,
} from "./library-repositories";
import {
  PgArtifactRepository,
  PgDirectorRepository,
  PgProjectRepository,
  PgProjectSettingsRepository,
  PgProjectShotRepository,
  PgPromptRepository,
  PgTemplateRepository,
  PgTimelineRepository,
  PgWorkbenchSessionRepository,
} from "./project-repositories";
import { createPgRegistryRepositories } from "./registry-repositories";
import { LegacyJsonAdapter } from "../legacy/json-adapter";

export function createPostgresRepositoryBundle(pool: IPgPool): RepositoryBundle {
  const reg = createPgRegistryRepositories(pool);

  return {
    user: new PgUserRepository(pool),
    workspace: new PgWorkspaceRepository(pool),
    registry: reg.registry,
    project: new PgProjectRepository(pool),
    projectSettings: new PgProjectSettingsRepository(pool),
    projectShot: new PgProjectShotRepository(pool),
    workbenchSession: new PgWorkbenchSessionRepository(pool),
    artifact: new PgArtifactRepository(pool),
    material: new PgMaterialRepository(pool),
    character: new PgCharacterRepository(pool),
    scene: new PgSceneRepository(pool),
    prop: new PgPropRepository(pool),
    template: new PgTemplateRepository(pool),
    prompt: new PgPromptRepository(pool),
    asset: new PgAssetRepository(pool),
    timeline: new PgTimelineRepository(pool),
    director: new PgDirectorRepository(pool),
    job: new PgJobRepository(pool),
    workflowRun: new PgWorkflowRunRepository(pool),
    clipAgent: new PgClipAgentRepository(pool),
    qa: new PgQaRepository(pool),
    voice: new PgVoiceRepository(pool),
    subtitle: new PgSubtitleRepository(pool),
    music: new PgMusicRepository(pool),
    effect: new PgEffectRepository(pool),
    export: new PgExportRepository(pool),
    cost: new PgCostRepository(pool),
    activityLog: new PgActivityLogRepository(pool),
    centerLog: new PgCenterLogRepository(pool),
    agentLog: new PgAgentLogRepository(pool),
    model: reg.model,
    provider: reg.provider,
    center: reg.center,
    agent: reg.agent,
    workflow: reg.workflow,
    legacyJson: new LegacyJsonAdapter(),
  };
}
