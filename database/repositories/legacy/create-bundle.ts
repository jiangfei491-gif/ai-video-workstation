import type { RepositoryBundle } from "../interfaces";
import { LegacyAssetRepository, LegacyJobRepository } from "./asset-job-repositories";
import { LegacyJsonAdapter } from "./json-adapter";
import {
  LegacyActivityLogRepository,
  LegacyAgentLogRepository,
  LegacyCenterLogRepository,
  LegacyClipAgentRepository,
  LegacyCostRepository,
  LegacyEffectRepository,
  LegacyExportRepository,
  LegacyMusicRepository,
  LegacyQaRepository,
  LegacySubtitleRepository,
  LegacyVoiceRepository,
  LegacyWorkflowRunRepository,
} from "./domain-repositories";
import { LegacyUserRepository, LegacyWorkspaceRepository } from "./identity-repositories";
import {
  LegacyCharacterRepository,
  LegacyMaterialRepository,
  LegacyPropRepository,
  LegacySceneRepository,
} from "./library-repositories";
import {
  LegacyArtifactRepository,
  LegacyDirectorRepository,
  LegacyProjectRepository,
  LegacyProjectSettingsRepository,
  LegacyProjectShotRepository,
  LegacyPromptRepository,
  LegacyTemplateRepository,
  LegacyTimelineRepository,
  LegacyWorkbenchSessionRepository,
} from "./project-repositories";
import { createLegacyRegistryRepositories } from "./registry-repositories";

export function createLegacyRepositoryBundle(): RepositoryBundle {
  const reg = createLegacyRegistryRepositories();

  return {
    user: new LegacyUserRepository(),
    workspace: new LegacyWorkspaceRepository(),
    registry: reg.registry,
    project: new LegacyProjectRepository(),
    projectSettings: new LegacyProjectSettingsRepository(),
    projectShot: new LegacyProjectShotRepository(),
    workbenchSession: new LegacyWorkbenchSessionRepository(),
    artifact: new LegacyArtifactRepository(),
    material: new LegacyMaterialRepository(),
    character: new LegacyCharacterRepository(),
    scene: new LegacySceneRepository(),
    prop: new LegacyPropRepository(),
    template: new LegacyTemplateRepository(),
    prompt: new LegacyPromptRepository(),
    asset: new LegacyAssetRepository(),
    timeline: new LegacyTimelineRepository(),
    director: new LegacyDirectorRepository(),
    job: new LegacyJobRepository(),
    workflowRun: new LegacyWorkflowRunRepository(),
    clipAgent: new LegacyClipAgentRepository(),
    qa: new LegacyQaRepository(),
    voice: new LegacyVoiceRepository(),
    subtitle: new LegacySubtitleRepository(),
    music: new LegacyMusicRepository(),
    effect: new LegacyEffectRepository(),
    export: new LegacyExportRepository(),
    cost: new LegacyCostRepository(),
    activityLog: new LegacyActivityLogRepository(),
    centerLog: new LegacyCenterLogRepository(),
    agentLog: new LegacyAgentLogRepository(),
    model: reg.model,
    provider: reg.provider,
    center: reg.center,
    agent: reg.agent,
    workflow: reg.workflow,
    legacyJson: new LegacyJsonAdapter(),
  };
}
