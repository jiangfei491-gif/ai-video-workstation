import type { IcAnalyzerResult, IcDiscoveredItem, IcUpgradeRecommendation } from "../types";
import { IC_MODELS, type IcModelId } from "./models";
import { scoreItems, type IcScoredItem } from "./scorer";

/**
 * 统一 AI Analyzer。
 * 默认便宜档（DeepSeek/Gemini Flash）批量分析，可选强档（Claude）复核高分项。
 * 真正的级联打分见 ./scorer.ts。
 */
export interface IcAnalyzer {
  readonly model: string;
  readonly connected: boolean;
  analyze(item: IcDiscoveredItem): Promise<IcAnalyzerResult>;
}

/** 单项分析（内部走 scorer）。批量请直接用 scoreItems，更省成本。 */
export class LlmAnalyzer implements IcAnalyzer {
  readonly model: IcModelId;
  constructor(model: IcModelId = "deepseek") {
    this.model = model;
  }
  get connected(): boolean {
    return IC_MODELS[this.model].available();
  }
  async analyze(item: IcDiscoveredItem): Promise<IcAnalyzerResult> {
    const run = await scoreItems([item], { cheapModel: this.model, useStrong: false });
    return scoredToAnalysis(run.items[0]);
  }
}

/** IcScoredItem → IcAnalyzerResult（供 DB 存储/历史） */
export function scoredToAnalysis(s: IcScoredItem): IcAnalyzerResult {
  return {
    id: `${s.item.id}-analysis`,
    itemId: s.item.id,
    model: s.scoredBy,
    summary: s.reason,
    tags: s.tags,
    category: s.module,
    relevance: s.score / 100,
    createdAt: new Date().toISOString(),
  };
}

/** IcScoredItem → IcUpgradeRecommendation（评分/模块/是否值得，均来自同一次打分，无额外成本） */
export function scoredToRecommendation(s: IcScoredItem): IcUpgradeRecommendation {
  return {
    id: `${s.item.id}-rec`,
    itemId: s.item.id,
    targetModule: s.module || "无",
    score: s.score,
    worthIntegrating: s.worth,
    recommendation: s.reason,
    createdAt: new Date().toISOString(),
  };
}

let analyzer: IcAnalyzer | null = null;
export function getIcAnalyzer(): IcAnalyzer {
  if (!analyzer) analyzer = new LlmAnalyzer();
  return analyzer;
}
