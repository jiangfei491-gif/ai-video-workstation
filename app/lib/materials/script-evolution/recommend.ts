import { getModelPerformanceStats, getStylePerformanceStats } from "./record-performance";
import type { EvolutionRecommendation, ScriptProviderId, ScriptStyleId, StylePerformanceEntry } from "./types";
import { ALL_STYLE_IDS, SCRIPT_PROVIDERS, SCRIPT_STYLES } from "./types";
import { listAvailableProviders } from "./providers";

export function recommendEvolutionStrategy(params: {
  category?: string;
  durationMinutes?: number;
}): EvolutionRecommendation[] {
  const available = listAvailableProviders();
  if (available.length === 0) return [];

  const models = getModelPerformanceStats().filter((m) => available.includes(m.provider));
  const styles = getStylePerformanceStats();
  const category = params.category?.trim() || "未分类";
  const isLong = (params.durationMinutes ?? 1) >= 5;

  const recommendations: EvolutionRecommendation[] = [];

  const rankedModels =
    models.length > 0
      ? [...models].sort((a, b) => {
          const aCat = a.categoryAvgs[category] ?? a.fullAvg;
          const bCat = b.categoryAvgs[category] ?? b.fullAvg;
          const aScore = (isLong ? a.fullAvg : a.outlineAvg) * 0.6 + aCat * 0.4 + a.winRate * 0.05;
          const bScore = (isLong ? b.fullAvg : b.outlineAvg) * 0.6 + bCat * 0.4 + b.winRate * 0.05;
          return bScore - aScore;
        })
      : [...available]
          .sort((a, b) => (a === "claude" ? -1 : b === "claude" ? 1 : 0))
          .map((p) => ({
            provider: p,
            modelVersion: "",
            winRate: 0,
            fullAvg: 0,
            outlineAvg: 0,
            categoryAvgs: {} as Record<string, number>,
          }));

  const topModel = rankedModels[0];
  if (topModel) {
    const label = SCRIPT_PROVIDERS.find((p) => p.id === topModel.provider)?.label ?? topModel.provider;
    const catAvg = topModel.categoryAvgs[category];
    recommendations.push({
      provider: topModel.provider,
      style: pickBestStyle(styles, topModel.provider),
      reason:
        models.length > 0
          ? `${label} 在「${category}」题材胜率 ${topModel.winRate}%${catAvg ? `，该类均分 ${catAvg}` : ""}`
          : `${label} 已配置，尚无历史数据，建议先试跑`,
      confidence: models.length > 0 ? Math.min(95, 50 + topModel.winRate * 0.5) : 40,
    });
  }

  const rankedStyles: StylePerformanceEntry[] =
    styles.length > 0
      ? [...styles].sort((a, b) => b.winRate - a.winRate || b.fullAvg - a.fullAvg)
      : ALL_STYLE_IDS.map((id) => ({
          style: id,
          useCount: 0,
          outlineAvg: 0,
          fullAvg: 0,
          championCount: 0,
          runnerUpCount: 0,
          winRate: 0,
          avgCompletionPredict: 0,
        }));

  const topStyle = rankedStyles[0];
  if (topStyle && recommendations[0]?.style !== topStyle.style) {
    const styleLabel = SCRIPT_STYLES.find((s) => s.id === topStyle.style)?.label ?? topStyle.style;
    recommendations.push({
      provider: topStyle.bestProvider ?? recommendations[0]?.provider ?? available[0],
      style: topStyle.style,
      reason:
        styles.length > 0
          ? `风格「${styleLabel}」历史冠军率较高（${topStyle.winRate}%）`
          : `风格「${styleLabel}」可尝试`,
      confidence: styles.length > 0 ? Math.min(90, 45 + topStyle.winRate * 0.5) : 35,
    });
  }

  if (recommendations.length === 0 && available[0]) {
    recommendations.push({
      provider: available[0],
      style: ALL_STYLE_IDS[0],
      reason: "根据已配置 API 默认推荐",
      confidence: 30,
    });
  }

  return recommendations.slice(0, 3);
}

function pickBestStyle(
  styles: ReturnType<typeof getStylePerformanceStats>,
  provider: ScriptProviderId
): ScriptStyleId {
  const forProvider = styles.filter((s) => s.bestProvider === provider);
  const pool = forProvider.length > 0 ? forProvider : styles;
  if (pool.length === 0) return ALL_STYLE_IDS[Math.floor(Math.random() * ALL_STYLE_IDS.length)];
  return [...pool].sort((a, b) => b.winRate - a.winRate)[0].style;
}
