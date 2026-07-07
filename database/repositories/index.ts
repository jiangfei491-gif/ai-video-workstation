/**
 * AI Cut V1 — Repository 层导出入口（P1）
 *
 * 业务代码第二阶段经 app/lib/data-access 门面引用。
 * P1 阶段 app/ 不得 import 本模块。
 */

export type * from "./interfaces";
export {
  createRepositoryBundle,
  getRepositoryBundle,
  resetRepositoryBundleCache,
  checkRepositoryConnectivity,
  shutdownRepositories,
  resolveRepositoryMode,
  loadDatabaseInfraConfig,
  getDefaultDatabaseUrl,
  createPgPool,
  type RepositoryFactoryOptions,
  type RepositoryMode,
  type IPgPool,
} from "./factory";

export {
  isDualWriteEnabled,
  getReadSource,
} from "./dual-write/config";

export { createDualWriteRepositoryBundle } from "./dual-write/create-bundle";
export { createDualWriteProxy } from "./dual-write/proxy";

/** 用户请求的 24 个核心 Repository 名称（用于文档/审计） */
export const CORE_REPOSITORY_NAMES = [
  "project",
  "asset",
  "material",
  "character",
  "scene",
  "prompt",
  "timeline",
  "director",
  "job",
  "qa",
  "voice",
  "subtitle",
  "music",
  "effect",
  "export",
  "cost",
  "user",
  "workspace",
  "model",
  "provider",
  "center",
  "agent",
  "workflow",
  "registry",
] as const;

/** RepositoryBundle 额外支撑 Repository */
export const SUPPORT_REPOSITORY_NAMES = [
  "projectSettings",
  "projectShot",
  "workbenchSession",
  "artifact",
  "prop",
  "template",
  "workflowRun",
  "clipAgent",
  "activityLog",
  "centerLog",
  "agentLog",
  "legacyJson",
] as const;
