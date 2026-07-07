/**
 * 双写 Repository 代理
 *
 * 读：默认 Legacy
 * 写：dualWriteEnabled 时 Legacy + PostgreSQL 同步
 */

export type DualWriteOptions = {
  dualWriteEnabled: boolean;
  readSource: "legacy" | "postgres";
  onDualWriteError?: (err: unknown, method: string) => void;
};

const WRITE_METHOD_PREFIXES = [
  "create",
  "update",
  "upsert",
  "append",
  "delete",
  "softDelete",
  "replace",
  "save",
  "link",
  "setActive",
  "complete",
  "start",
  "inject",
  "write",
  "mapLegacy",
];

function isWriteMethod(name: string): boolean {
  return WRITE_METHOD_PREFIXES.some(
    (p) => name.startsWith(p) || name === "del" || name === "set"
  );
}

export function createDualWriteProxy<T extends object>(
  legacy: T,
  postgres: T,
  options: DualWriteOptions
): T {
  const readTarget = options.readSource === "postgres" ? postgres : legacy;

  return new Proxy(legacy, {
    get(_target, prop, _receiver) {
      const key = String(prop);
      const legacyVal = (legacy as Record<string, unknown>)[key];
      const pgVal = (postgres as Record<string, unknown>)[key];
      const readVal = (readTarget as Record<string, unknown>)[key];

      if (typeof legacyVal !== "function") {
        return readVal;
      }

      return async (...args: unknown[]) => {
        if (isWriteMethod(key)) {
          const legacyResult = await (legacyVal as (...a: unknown[]) => unknown).apply(
            legacy,
            args
          );

          if (options.dualWriteEnabled && typeof pgVal === "function") {
            try {
              await (pgVal as (...a: unknown[]) => unknown).apply(postgres, args);
            } catch (err) {
              options.onDualWriteError?.(err, key);
            }
          }

          return legacyResult;
        }

        const fn = (readTarget as Record<string, unknown>)[key];
        if (typeof fn === "function") {
          return (fn as (...a: unknown[]) => unknown).apply(readTarget, args);
        }
        return readVal;
      };
    },
  }) as T;
}

export function wrapBundleWithDualWrite<T extends Record<string, object>>(
  legacyBundle: T,
  postgresBundle: T,
  options: DualWriteOptions
): T {
  const result = {} as T;
  for (const key of Object.keys(legacyBundle) as (keyof T)[]) {
    result[key] = createDualWriteProxy(
      legacyBundle[key],
      postgresBundle[key],
      options
    );
  }
  return result;
}
