import type { IcDiscoveredItem, IcPlatformId, IcSource } from "../types";

/**
 * 统一 Crawler Provider 接口。
 * 以后新增平台：只新增一个实现此接口的 Provider 并注册，不改 Framework。
 * 本阶段所有 Provider 均为占位实现（不请求第三方、不抓数据）。
 */
export interface IcProvider {
  readonly slug: string;
  readonly platformId: IcPlatformId;
  readonly label: string;
  /** 是否已接入真实 API（本阶段全部 false） */
  readonly connected: boolean;

  /** 测试连接（占位：不请求） */
  testConnection(): Promise<{ ok: boolean; message: string }>;

  /** 发现新项目（占位：返回空，标注待接入） */
  discover(source: IcSource, params?: { page?: number; pageSize?: number }): Promise<{
    items: IcDiscoveredItem[];
    hasMore: boolean;
  }>;

  /** 取单项详情（占位） */
  getDetail?(externalId: string): Promise<IcDiscoveredItem | null>;
}

/** 占位 Provider 工厂：架构就绪、待接入 API。新增真实 Provider 时替换即可。 */
export function createPlaceholderProvider(platformId: IcPlatformId, label: string): IcProvider {
  return {
    slug: `${platformId}-placeholder`,
    platformId,
    label,
    connected: false,
    async testConnection() {
      return { ok: false, message: "架构就绪 · 待接入 API" };
    },
    async discover() {
      // 本阶段不请求第三方、不抓数据
      return { items: [], hasMore: false };
    },
    async getDetail() {
      return null;
    },
  };
}
