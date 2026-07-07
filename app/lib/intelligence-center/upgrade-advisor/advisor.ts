import type { IcAnalyzerResult, IcDiscoveredItem, IcUpgradeRecommendation } from "../types";

/**
 * Upgrade Advisor（升级顾问）。
 * 负责：分析项目价值 → 适合哪个模块 → 是否值得接入 → 生成评分与建议。
 * 本阶段：接口 + 规则占位打分（不接模型）。
 */

/** AI Video OS 现有模块（供"适合哪个模块"映射） */
export const AI_VIDEO_OS_MODULES = [
  "创作中心",
  "AI导演",
  "配音中心",
  "字幕中心",
  "音乐中心",
  "特效中心",
  "质检中心",
  "内容中心",
  "无限画布",
  "AI剪辑",
  "资源中心",
] as const;

export interface IcAdvisor {
  readonly connected: boolean;
  evaluate(item: IcDiscoveredItem, analysis?: IcAnalyzerResult): IcUpgradeRecommendation;
}

export class PlaceholderAdvisor implements IcAdvisor {
  readonly connected = false;

  evaluate(item: IcDiscoveredItem, analysis?: IcAnalyzerResult): IcUpgradeRecommendation {
    // 占位：真实评分将由 DeepSeek + 规则综合（star/下载量/相关度/活跃度…）
    const score = 0;
    return {
      id: `${item.id}-rec`,
      itemId: item.id,
      targetModule: "待评估",
      score,
      worthIntegrating: false,
      recommendation: analysis ? "待接入 API 后生成建议" : "架构就绪 · 待接入 API",
      createdAt: new Date().toISOString(),
    };
  }
}

let advisor: IcAdvisor | null = null;
export function getIcAdvisor(): IcAdvisor {
  if (!advisor) advisor = new PlaceholderAdvisor();
  return advisor;
}
