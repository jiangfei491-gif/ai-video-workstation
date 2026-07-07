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
import { readJsonFile } from "../shared/json-store";
import { clientOnlyNull } from "../shared/client-only-stub";

export class LegacyVoiceRepository implements IVoiceRepository {
  async getCenterState(_projectId: UUID): Promise<unknown | null> {
    return clientOnlyNull();
  }
  async listVoicePresets(_workspaceId?: UUID): Promise<unknown[]> {
    return [];
  }
}

export class LegacySubtitleRepository implements ISubtitleRepository {
  async getCenterState(_projectId: UUID): Promise<unknown | null> {
    return clientOnlyNull();
  }
  async listStyles(_workspaceId?: UUID): Promise<unknown[]> {
    return [];
  }
}

export class LegacyMusicRepository implements IMusicRepository {
  async getCenterState(_projectId: UUID): Promise<unknown | null> {
    return clientOnlyNull();
  }
  async listTracks(_workspaceId?: UUID): Promise<unknown[]> {
    return [];
  }
}

export class LegacyEffectRepository implements IEffectRepository {
  async getCenterState(_projectId: UUID): Promise<unknown | null> {
    return clientOnlyNull();
  }
  async listPresets(_workspaceId?: UUID): Promise<unknown[]> {
    return [];
  }
}

export class LegacyQaRepository implements IQaRepository {
  async saveReport(report: unknown): Promise<unknown> {
    return report;
  }
  async listByProject(_projectId: UUID): Promise<unknown[]> {
    return [];
  }
  async appendLog(_entry: unknown): Promise<void> {
    /* no-op */
  }
}

export class LegacyExportRepository implements IExportRepository {
  async create(record: unknown): Promise<unknown> {
    return record;
  }
  async listByProject(_projectId: UUID): Promise<unknown[]> {
    return [];
  }
}

export class LegacyCostRepository implements ICostRepository {
  async append(entry: unknown): Promise<unknown> {
    return entry;
  }

  async sumByProject(_projectId: UUID): Promise<unknown> {
    const store = readJsonFile("openai-usage-stats.json", {}, "data");
    return { source: "legacy-json", store };
  }
}

export class LegacyWorkflowRunRepository implements IWorkflowRunRepository {
  async start(projectId: UUID, workflowSlug: string, jobId?: UUID): Promise<unknown> {
    return { projectId, workflowSlug, jobId, status: "running" };
  }
  async appendLog(_runId: UUID, _entry: unknown): Promise<void> {
    /* no-op */
  }
  async complete(_runId: UUID, _status: string): Promise<void> {
    /* no-op */
  }
}

export class LegacyClipAgentRepository implements IClipAgentRepository {
  async createRun(input: unknown): Promise<unknown> {
    return input;
  }
  async appendCommands(_runId: UUID, commands: unknown[]): Promise<void> {
    void commands;
  }
}

export class LegacyActivityLogRepository implements IActivityLogRepository {
  async append(entry: unknown): Promise<unknown> {
    return entry;
  }
  async list(_params: unknown): Promise<unknown[]> {
    return [];
  }
}

export class LegacyCenterLogRepository implements ICenterLogRepository {
  async append(_entry: unknown): Promise<void> {
    /* no-op */
  }
  async listByProject(_projectId: UUID, _centerSlug: string): Promise<unknown[]> {
    return [];
  }
}

export class LegacyAgentLogRepository implements IAgentLogRepository {
  async append(_entry: unknown): Promise<void> {
    /* no-op */
  }
  async listByProject(_projectId: UUID, _agentSlug: string): Promise<unknown[]> {
    return [];
  }
}
