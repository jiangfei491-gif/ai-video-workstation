/**
 * Resource Center Phase 3 — Repository 契约
 */

import type { PageParams, PageResult, UUID } from "../interfaces";
import type { LogRow } from "./interfaces";

export type AnalysisStatus =
  | "pending_analysis"
  | "analyzing"
  | "analysis_complete"
  | "analysis_failed";

export type ImportStatus =
  | "pending_import"
  | "importing"
  | "imported"
  | "import_failed";

export type LibraryItemStatus = "imported" | "disabled" | "deleted";

export interface AnalysisResultPayload {
  resourceType?: string;
  libraryId?: string;
  title?: string;
  category?: string;
  recommendedCategory?: string;
  tags?: string[];
  keywords?: string[];
  description?: string;
  language?: string;
  style?: string;
  mood?: string;
  purpose?: string;
  platform?: string;
  qualityScore?: number;
  rating?: number;
  isDuplicate?: boolean;
  duplicateOfItemId?: string | null;
  canImport?: boolean;
  rejectReason?: string;
  model?: string;
  analyzedAt?: string;
}

export interface AnalysisTaskRow {
  id: UUID;
  workspace_id: UUID;
  download_task_id: UUID | null;
  source_id: UUID | null;
  local_path: string;
  filename: string;
  mime_type: string;
  file_size: number;
  sha256: string | null;
  status: AnalysisStatus;
  library_id: string | null;
  analysis_result: AnalysisResultPayload;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportTaskRow {
  id: UUID;
  workspace_id: UUID;
  analysis_task_id: UUID;
  library_item_id: UUID | null;
  library_id: string;
  status: ImportStatus;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LibraryItemRow {
  id: UUID;
  workspace_id: UUID;
  library_id: string;
  download_task_id: UUID | null;
  analysis_task_id: UUID | null;
  import_task_id: UUID | null;
  source_id: UUID | null;
  title: string;
  description: string;
  category: string;
  language: string;
  style: string;
  mood: string;
  purpose: string;
  platform: string;
  status: LibraryItemStatus;
  rating: number | null;
  quality_score: number | null;
  enabled: boolean;
  favorite: boolean;
  local_path: string;
  thumbnail_path: string;
  preview_path: string;
  tags: string[];
  keywords: string[];
  sha256: string | null;
  file_size: number;
  mime_type: string;
  metadata: Record<string, unknown>;
  db_primary_table: string;
  db_record_id: UUID | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface LibraryItemQuery {
  library_id?: string;
  category?: string;
  tag?: string;
  keyword?: string;
  style?: string;
  mood?: string;
  language?: string;
  platform?: string;
  q?: string;
  min_rating?: number;
  min_quality?: number;
  enabled?: boolean;
  favorite?: boolean;
  sort?: "recent" | "rating" | "quality" | "popular";
  limit?: number;
  offset?: number;
}

export interface ResourceRelationRow {
  id: UUID;
  workspace_id: UUID;
  item_id_a: UUID;
  item_id_b: UUID;
  relation_type: string;
  score: number | null;
  created_at: string;
}

export interface AccessLogInput {
  module_id: string;
  module_label?: string;
  query: Record<string, unknown>;
  result_count: number;
}

export interface IAnalysisTaskRepository {
  findById(id: UUID): Promise<AnalysisTaskRow | null>;
  findByDownloadTask(downloadTaskId: UUID): Promise<AnalysisTaskRow | null>;
  list(
    workspaceId: UUID,
    filters?: { status?: AnalysisStatus },
    params?: PageParams
  ): Promise<PageResult<AnalysisTaskRow>>;
  create(input: {
    workspace_id: UUID;
    download_task_id?: UUID | null;
    source_id?: UUID | null;
    local_path: string;
    filename: string;
    mime_type?: string;
    file_size?: number;
    sha256?: string | null;
  }): Promise<AnalysisTaskRow>;
  update(id: UUID, patch: Partial<AnalysisTaskRow>): Promise<AnalysisTaskRow | null>;
  appendLog(taskId: UUID, level: string, message: string, payload?: Record<string, unknown>): Promise<void>;
  listLogs(taskId: UUID, limit?: number): Promise<LogRow[]>;
}

export interface IImportTaskRepository {
  findById(id: UUID): Promise<ImportTaskRow | null>;
  list(
    workspaceId: UUID,
    filters?: { status?: ImportStatus; library_id?: string },
    params?: PageParams
  ): Promise<PageResult<ImportTaskRow>>;
  create(input: {
    workspace_id: UUID;
    analysis_task_id: UUID;
    library_id: string;
  }): Promise<ImportTaskRow>;
  update(id: UUID, patch: Partial<ImportTaskRow>): Promise<ImportTaskRow | null>;
  appendLog(taskId: UUID, level: string, message: string, payload?: Record<string, unknown>): Promise<void>;
  listLogs(taskId: UUID, limit?: number): Promise<LogRow[]>;
}

export interface ILibraryItemRepository {
  findById(id: UUID): Promise<LibraryItemRow | null>;
  findBySha256(workspaceId: UUID, sha256: string): Promise<LibraryItemRow | null>;
  list(workspaceId: UUID, query?: LibraryItemQuery): Promise<PageResult<LibraryItemRow>>;
  count(workspaceId: UUID, query?: LibraryItemQuery): Promise<number>;
  create(input: Omit<LibraryItemRow, "id" | "created_at" | "updated_at" | "deleted_at">): Promise<LibraryItemRow>;
  update(id: UUID, patch: Partial<LibraryItemRow>): Promise<LibraryItemRow | null>;
  softDelete(id: UUID): Promise<boolean>;
  recordAccess(workspaceId: UUID, input: AccessLogInput): Promise<void>;
  addRelation(
    workspaceId: UUID,
    itemIdA: UUID,
    itemIdB: UUID,
    relationType: string,
    score?: number
  ): Promise<void>;
  findSimilar(itemId: UUID, limit?: number): Promise<LibraryItemRow[]>;
}

export interface ResourceCenterPhase3RepositoryBundle {
  analysisTask: IAnalysisTaskRepository;
  importTask: IImportTaskRepository;
  libraryItem: ILibraryItemRepository;
}
