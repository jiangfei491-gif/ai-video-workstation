/**
 * Resource Center V1 — 类型与统一接口
 */

export type LibraryId =
  | "image"
  | "video"
  | "music"
  | "sfx"
  | "voice"
  | "subtitle"
  | "effect"
  | "prompt"
  | "character"
  | "lora"
  | "dataset";

/** 12 库统一能力（V1 架构声明，下一阶段实现读写） */
export interface LibraryCapabilities {
  category: boolean;
  tags: boolean;
  search: boolean;
  favorite: boolean;
  rating: boolean;
  enableDisable: boolean;
  stats: boolean;
  dbIndex: boolean;
  resourceCount: boolean;
  updatedAt: boolean;
  thumbnail: boolean;
  preview: boolean;
  detail: boolean;
}

export interface LibraryDbMapping {
  /** 主表 */
  primaryTable: string;
  /** 可选关联表 */
  secondaryTables?: string[];
  /** 只读 COUNT 条件（不含用户输入） */
  countWhere?: string;
  /** assets.kind 过滤（如适用） */
  assetKinds?: string[];
  /** resource_registry.slug */
  registrySlug?: string;
  /** templates.template_kind（如适用） */
  templateKind?: string;
  notes?: string;
}

export interface LibraryDefinition {
  id: LibraryId;
  slug: string;
  title: string;
  titleZh: string;
  description: string;
  storageDir: string;
  categories: string[];
  capabilities: LibraryCapabilities;
  dbMapping: LibraryDbMapping;
}

export interface LibraryStats {
  resourceCount: number;
  fileCount: number;
  enabledCount: number;
  disabledCount: number;
  favoriteCount: number;
  dbRecordCount: number;
  lastUpdatedAt: string | null;
}

export interface ResourceItemMeta {
  id: string;
  libraryId: LibraryId;
  title: string;
  category?: string;
  tags: string[];
  enabled: boolean;
  favorite: boolean;
  rating?: number;
  thumbnailUrl?: string;
  previewUrl?: string;
  /** 真实文件地址（可播放/下载） */
  fileUrl?: string;
  mimeType?: string;
  fileSize?: number;
  updatedAt: string;
}

export interface LibraryListQuery {
  category?: string;
  tag?: string;
  q?: string;
  favorite?: boolean;
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

export interface LibraryListResult {
  items: ResourceItemMeta[];
  total: number;
  stats: LibraryStats;
}

/** 所有内容库必须实现的统一接口 */
export interface ILibrary {
  readonly definition: LibraryDefinition;

  getStoragePath(): string;
  ensureLayout(): void;
  getStats(): Promise<LibraryStats>;
  list(query?: LibraryListQuery): Promise<LibraryListResult>;
  getById(_id: string): Promise<ResourceItemMeta | null>;
}

export interface ResourceCenterManifest {
  version: 1;
  libraryIds: LibraryId[];
  ensuredAt: string;
  workspaceRoot: string;
}
