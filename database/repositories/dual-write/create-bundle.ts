import type { RepositoryBundle } from "../interfaces";
import { createLegacyRepositoryBundle } from "../legacy/create-bundle";
import { createPostgresRepositoryBundle } from "../pg/create-bundle";
import type { IPgPool } from "../pg/pool";
import { wrapBundleWithDualWrite, type DualWriteOptions } from "./proxy";

export interface DualWriteBundleOptions extends DualWriteOptions {
  pool?: IPgPool;
}

/**
 * 双写 Bundle：读 Legacy（默认），写 Legacy + PG（需 dualWriteEnabled=true）
 */
export function createDualWriteRepositoryBundle(
  pool: IPgPool,
  options: DualWriteBundleOptions
): RepositoryBundle {
  const legacy = createLegacyRepositoryBundle();
  const postgres = createPostgresRepositoryBundle(pool);

  return wrapBundleWithDualWrite(
    legacy as unknown as Record<string, object>,
    postgres as unknown as Record<string, object>,
    {
      dualWriteEnabled: options.dualWriteEnabled,
      readSource: options.readSource,
      onDualWriteError: options.onDualWriteError,
    }
  ) as unknown as RepositoryBundle;
}
