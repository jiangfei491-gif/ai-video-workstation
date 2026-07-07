import type { IcPlatformId, IcSource } from "./types";

/**
 * 统一 Source Registry。
 * 所有平台的订阅源都注册到这里，不写死。以后新增源只 register，不改代码结构。
 * 本阶段为内存注册表（接 API 阶段改为读写 ic_sources 表）。
 */
const sources = new Map<string, IcSource>();

export function registerIcSource(source: IcSource): void {
  sources.set(source.id, source);
}

export function listIcSources(platformId?: IcPlatformId): IcSource[] {
  const all = [...sources.values()];
  return platformId ? all.filter((s) => s.platformId === platformId) : all;
}

export function getIcSource(id: string): IcSource | undefined {
  return sources.get(id);
}

export function removeIcSource(id: string): boolean {
  return sources.delete(id);
}

export function countIcSources(platformId: IcPlatformId): number {
  return listIcSources(platformId).length;
}
