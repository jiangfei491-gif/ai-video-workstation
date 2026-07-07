import type { IcCrawlerTask, IcDiscoveredItem, IcSource } from "../types";
import { getIcProvider, getIcProviderForPlatform } from "./registry";

/**
 * 统一 Crawler Framework。
 * 所有平台走同一套调度接口；平台差异全部封装在 Provider 里。
 * 本阶段：Framework 结构就绪，但不真正抓取（provider.discover 返回空 + 待接入标注）。
 */
export class IcCrawlerFramework {
  /** 对一个 Source 发起发现（占位：不抓数据） */
  async runDiscovery(source: IcSource): Promise<{ task: Partial<IcCrawlerTask>; items: IcDiscoveredItem[]; note: string }> {
    const provider = getIcProvider(source.providerSlug) ?? getIcProviderForPlatform(source.platformId);
    if (!provider) {
      return { task: { status: "failed", error: "无 Provider" }, items: [], note: "未注册 Provider" };
    }
    if (!provider.connected) {
      // 架构阶段：不请求第三方
      return {
        task: { status: "pending", itemsFound: 0 },
        items: [],
        note: "架构就绪 · 待接入 API（本阶段不抓取）",
      };
    }
    // 接入 API 后：实际调用 provider.discover
    const { items } = await provider.discover(source);
    return { task: { status: "crawling", itemsFound: items.length }, items, note: "" };
  }
}

let framework: IcCrawlerFramework | null = null;
export function getIcCrawlerFramework(): IcCrawlerFramework {
  if (!framework) framework = new IcCrawlerFramework();
  return framework;
}
