/**
 * Resource Center Phase 2 — Repository 契约
 */

import type { PageParams, PageResult, UUID } from "../interfaces";

export type SourceStatus = "active" | "disabled" | "error";
export type TaskStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface ResourceSourceRow {
  id: UUID;
  workspace_id: UUID;
  name: string;
  url: string;
  resource_types: string[];
  site_category: string;
  country: string;
  language: string;
  license_type: string;
  license: string;
  api_url: string;
  rss_url: string;
  requires_login: boolean;
  requires_api_key: boolean;
  supports_crawler: boolean;
  supports_downloader: boolean;
  provider_slug: string;
  crawl_frequency: string;
  last_crawled_at: string | null;
  last_updated_at: string | null;
  status: SourceStatus;
  enabled: boolean;
  notes: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ResourceSourceInput {
  name: string;
  url?: string;
  resource_types?: string[];
  site_category?: string;
  country?: string;
  language?: string;
  license_type?: string;
  license?: string;
  api_url?: string;
  rss_url?: string;
  requires_login?: boolean;
  requires_api_key?: boolean;
  supports_crawler?: boolean;
  supports_downloader?: boolean;
  provider_slug?: string;
  crawl_frequency?: string;
  status?: SourceStatus;
  enabled?: boolean;
  notes?: string;
  metadata?: Record<string, unknown>;
  // 服务端维护的时间戳（抓取/连通性更新时写入；创建时通常省略）
  last_crawled_at?: string;
  last_updated_at?: string;
}

export interface ResourceSourceQuery {
  q?: string;
  site_category?: string;
  resource_type?: string;
  enabled?: boolean;
  status?: SourceStatus;
  sort?: "name" | "updated_at" | "created_at";
  order?: "asc" | "desc";
}

export interface CrawlerTaskRow {
  id: UUID;
  workspace_id: UUID;
  source_id: UUID;
  status: TaskStatus;
  progress: Record<string, unknown>;
  queue_position: number | null;
  pages_total: number | null;
  pages_done: number;
  items_found: number;
  error_message: string | null;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DownloadTaskRow {
  id: UUID;
  workspace_id: UUID;
  source_id: UUID | null;
  crawler_task_id: UUID | null;
  remote_url: string;
  local_path: string;
  filename: string;
  status: TaskStatus;
  bytes_total: number | null;
  bytes_downloaded: number;
  sha256_expected: string | null;
  sha256_actual: string | null;
  speed_bps: number | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogRow {
  id: UUID;
  task_id: UUID;
  level: string;
  message: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface IResourceSourceRepository {
  findById(id: UUID): Promise<ResourceSourceRow | null>;
  list(workspaceId: UUID, query?: ResourceSourceQuery, params?: PageParams): Promise<PageResult<ResourceSourceRow>>;
  count(workspaceId: UUID, query?: ResourceSourceQuery): Promise<number>;
  create(workspaceId: UUID, input: ResourceSourceInput): Promise<ResourceSourceRow>;
  update(id: UUID, patch: Partial<ResourceSourceInput>): Promise<ResourceSourceRow | null>;
  softDelete(id: UUID): Promise<boolean>;
  stats(workspaceId: UUID): Promise<{ total: number; enabled: number; disabled: number; byCategory: Record<string, number> }>;
}

export interface ICrawlerTaskRepository {
  findById(id: UUID): Promise<CrawlerTaskRow | null>;
  list(workspaceId: UUID, filters?: { source_id?: UUID; status?: TaskStatus }, params?: PageParams): Promise<PageResult<CrawlerTaskRow>>;
  create(workspaceId: UUID, sourceId: UUID): Promise<CrawlerTaskRow>;
  updateStatus(id: UUID, status: TaskStatus, patch?: Partial<CrawlerTaskRow>): Promise<CrawlerTaskRow | null>;
  appendLog(taskId: UUID, level: string, message: string, payload?: Record<string, unknown>): Promise<void>;
  listLogs(taskId: UUID, limit?: number): Promise<LogRow[]>;
  delete(id: UUID): Promise<boolean>;
}

export interface IDownloadTaskRepository {
  findById(id: UUID): Promise<DownloadTaskRow | null>;
  list(workspaceId: UUID, filters?: { status?: TaskStatus; source_id?: UUID }, params?: PageParams): Promise<PageResult<DownloadTaskRow>>;
  create(input: Omit<DownloadTaskRow, "id" | "created_at" | "updated_at" | "status" | "bytes_downloaded" | "retry_count" | "speed_bps" | "sha256_actual" | "error_message" | "started_at" | "paused_at" | "completed_at"> & { status?: TaskStatus }): Promise<DownloadTaskRow>;
  update(id: UUID, patch: Partial<DownloadTaskRow>): Promise<DownloadTaskRow | null>;
  appendLog(taskId: UUID, level: string, message: string, payload?: Record<string, unknown>): Promise<void>;
  listLogs(taskId: UUID, limit?: number): Promise<LogRow[]>;
}

export interface ResourceCenterRepositoryBundle {
  source: IResourceSourceRepository;
  crawlerTask: ICrawlerTaskRepository;
  downloadTask: IDownloadTaskRepository;
}
