export type {
  ILibrary,
  LibraryCapabilities,
  LibraryDbMapping,
  LibraryDefinition,
  LibraryId,
  LibraryListQuery,
  LibraryListResult,
  LibraryStats,
  ResourceCenterManifest,
  ResourceItemMeta,
} from "./types";

export {
  LIBRARY_DEFINITIONS,
  LIBRARY_BY_ID,
  LIBRARY_IDS,
  STANDARD_LIBRARY_CAPABILITIES,
} from "./libraries/definitions";

export { BaseLibrary } from "./libraries/base-library";

export {
  getLibraryManager,
  resetLibraryManager,
  LibraryManager,
} from "./library-manager";

export {
  getLibraryDbMapping,
  RESOURCE_CENTER_DB_INDEX,
  listAllDbMappings,
} from "./db-mapping";

export {
  resolveLibraryStoragePath,
  resolveLibraryMetaPath,
  resolveResourceCenterManifestPath,
  RESOURCE_CENTER_LIBRARY_REL,
} from "./paths";

import { getLibraryManager as resolveLibraryManager } from "./library-manager";

/**
 * Center 模块统一入口 — V1 内容库（Library Manager）
 * Phase 2（Source/Crawler/Downloader）请从 `@/app/lib/resource-center/phase2` 导入
 */
export function getResourceCenter() {
  return resolveLibraryManager();
}
