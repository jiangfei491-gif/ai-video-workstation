import { createPgPool, getOrCreateDefaultPool, type IPgPool } from "../pg/pool";
import type { ResourceCenterRepositoryBundle } from "./interfaces";
import type { ResourceCenterPhase3RepositoryBundle } from "./phase3-interfaces";
import type { ResourceCenterSchedulerRepositoryBundle } from "./scheduler-interfaces";
import { createResourceCenterRepositoryBundle } from "./pg-repositories";
import { createResourceCenterPhase3RepositoryBundle } from "./pg-phase3-repositories";
import { createSchedulerRepositoryBundle } from "./pg-scheduler-repositories";

let cached: ResourceCenterRepositoryBundle | null = null;
let cachedPhase3: ResourceCenterPhase3RepositoryBundle | null = null;
let cachedScheduler: ResourceCenterSchedulerRepositoryBundle | null = null;

export function createResourceCenterRepos(pool?: IPgPool): ResourceCenterRepositoryBundle {
  const p = pool ?? getOrCreateDefaultPool();
  return createResourceCenterRepositoryBundle(p);
}

export function createResourceCenterPhase3Repos(pool?: IPgPool): ResourceCenterPhase3RepositoryBundle {
  const p = pool ?? getOrCreateDefaultPool();
  return createResourceCenterPhase3RepositoryBundle(p);
}

export function getResourceCenterRepos(): ResourceCenterRepositoryBundle {
  if (!cached) cached = createResourceCenterRepos();
  return cached;
}

export function getResourceCenterPhase3Repos(): ResourceCenterPhase3RepositoryBundle {
  if (!cachedPhase3) cachedPhase3 = createResourceCenterPhase3Repos();
  return cachedPhase3;
}

export function createResourceCenterSchedulerRepos(pool?: IPgPool): ResourceCenterSchedulerRepositoryBundle {
  const p = pool ?? getOrCreateDefaultPool();
  return createSchedulerRepositoryBundle(p);
}

export function getResourceCenterSchedulerRepos(): ResourceCenterSchedulerRepositoryBundle {
  if (!cachedScheduler) cachedScheduler = createResourceCenterSchedulerRepos();
  return cachedScheduler;
}

export async function withResourceCenterRepos<T>(
  fn: (repos: ResourceCenterRepositoryBundle) => Promise<T>,
  pool?: IPgPool
): Promise<T> {
  const p = pool ?? createPgPool();
  const ownPool = !pool;
  try {
    return await fn(createResourceCenterRepositoryBundle(p));
  } finally {
    if (ownPool) await p.end();
  }
}

export function resetResourceCenterReposCache(): void {
  cached = null;
  cachedPhase3 = null;
  cachedScheduler = null;
}

export type * from "./interfaces";
export type * from "./phase3-interfaces";
export type * from "./scheduler-interfaces";
