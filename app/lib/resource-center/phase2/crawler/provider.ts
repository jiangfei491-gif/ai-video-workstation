import type { ResourceSourceRow } from "@/database/repositories/resource-center/interfaces";

/** Crawler 发现的资源条目（未入库 Library） */
export interface CrawlerResourceItem {
  externalId: string;
  title: string;
  detailUrl?: string;
  downloadUrl?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CrawlerListParams {
  page: number;
  pageSize: number;
  query?: string;
}

export interface CrawlerListResult {
  items: CrawlerResourceItem[];
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
  updatedAt?: string;
}

export interface CrawlerDetailResult {
  item: CrawlerResourceItem;
}

export interface CrawlerDownloadUrlResult {
  downloadUrl: string;
  filename?: string;
  sha256?: string;
  bytesTotal?: number;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs?: number;
  statusCode?: number;
  message: string;
}

/**
 * CrawlerProvider — 所有资源站统一接口。
 * 新增资源站只需注册 Provider，不修改 Crawler Manager。
 */
export interface CrawlerProvider {
  readonly slug: string;
  readonly label: string;

  testConnection(source: ResourceSourceRow): Promise<ConnectionTestResult>;
  listResources(source: ResourceSourceRow, params: CrawlerListParams): Promise<CrawlerListResult>;
  getDetail(source: ResourceSourceRow, externalId: string): Promise<CrawlerDetailResult>;
  getDownloadUrl(source: ResourceSourceRow, externalId: string): Promise<CrawlerDownloadUrlResult>;
  search?(source: ResourceSourceRow, query: string, params: CrawlerListParams): Promise<CrawlerListResult>;
}

export type CrawlerProviderFactory = () => CrawlerProvider;
