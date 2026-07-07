/**
 * Scheduler Repository 契约
 */

import type { PageParams, PageResult, UUID } from "../interfaces";
import type { SchedulerGlobalConfig, SourceScheduleConfig } from "@/app/lib/resource-center/phase2/scheduler/types";

export interface SchedulerConfigRow {
  id: UUID;
  workspace_id: UUID;
  config: SchedulerGlobalConfig;
  paused: boolean;
  created_at: string;
  updated_at: string;
}

export interface SourceScheduleRow {
  id: UUID;
  workspace_id: UUID;
  source_id: UUID;
  enabled: boolean;
  crawl_mode: string;
  frequency: string;
  custom_cron: string;
  crawl_times: string[];
  max_items: number;
  scan_mode: string;
  priority: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_sync_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SchedulerRunRow {
  id: UUID;
  workspace_id: UUID;
  source_id: UUID | null;
  trigger_type: string;
  status: string;
  crawler_task_id: UUID | null;
  started_at: string | null;
  completed_at: string | null;
  items_found: number;
  items_failed: number;
  error_message: string | null;
  created_at: string;
}

export interface SchedulerLogRow {
  id: UUID;
  workspace_id: UUID;
  level: string;
  message: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ISchedulerRepository {
  getConfig(workspaceId: UUID): Promise<SchedulerConfigRow | null>;
  upsertConfig(workspaceId: UUID, config: SchedulerGlobalConfig, paused?: boolean): Promise<SchedulerConfigRow>;
  setPaused(workspaceId: UUID, paused: boolean): Promise<void>;

  getSourceSchedule(sourceId: UUID): Promise<SourceScheduleRow | null>;
  upsertSourceSchedule(
    workspaceId: UUID,
    sourceId: UUID,
    patch: Partial<SourceScheduleConfig> & { next_run_at?: string | null; last_run_at?: string | null; last_sync_at?: string | null }
  ): Promise<SourceScheduleRow>;
  listDueSchedules(workspaceId: UUID, before: Date): Promise<SourceScheduleRow[]>;
  listAllSchedules(workspaceId: UUID): Promise<SourceScheduleRow[]>;

  createRun(input: {
    workspace_id: UUID;
    source_id: UUID;
    trigger_type: string;
    crawler_task_id?: UUID | null;
  }): Promise<SchedulerRunRow>;
  updateRun(id: UUID, patch: Partial<SchedulerRunRow>): Promise<SchedulerRunRow | null>;
  listRecentRuns(workspaceId: UUID, limit?: number): Promise<SchedulerRunRow[]>;

  appendLog(workspaceId: UUID, level: string, message: string, payload?: Record<string, unknown>): Promise<void>;
  listLogs(workspaceId: UUID, limit?: number): Promise<SchedulerLogRow[]>;
  purgeLogs(workspaceId: UUID, before: Date): Promise<number>;
}

export interface ResourceCenterSchedulerRepositoryBundle {
  scheduler: ISchedulerRepository;
}
