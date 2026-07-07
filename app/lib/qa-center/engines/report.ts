import type { QaCenterResult, QaIssue, QaScoreBreakdown } from "../types";

export function buildQaReport(params: {
  score: QaScoreBreakdown;
  issues: QaIssue[];
  suggestions: string[];
  retry: QaCenterResult["retry"];
}): { json: string; markdown: string } {
  const payload = {
    qualityScore: params.score.overall,
    breakdown: params.score,
    issueCount: params.issues.length,
    issues: params.issues,
    suggestions: params.suggestions,
    retry: params.retry,
    generatedAt: new Date().toISOString(),
  };

  const lines = [
    `# AI Cut 质检报告`,
    ``,
    `**Quality Score: ${params.score.overall}**`,
    ``,
    `| 维度 | 分数 |`,
    `|------|------|`,
    `| 规则引擎 | ${params.score.rules} |`,
    ...(params.score.rhythm != null ? [`| 节奏 | ${params.score.rhythm} |`] : []),
    ...(params.score.shots != null ? [`| 镜头 | ${params.score.shots} |`] : []),
    ...(params.score.subtitles != null ? [`| 字幕 | ${params.score.subtitles} |`] : []),
    ...(params.score.music != null ? [`| 音乐 | ${params.score.music} |`] : []),
    ...(params.score.effects != null ? [`| 特效 | ${params.score.effects} |`] : []),
    ``,
    `## 建议`,
    ...params.suggestions.map((s) => `- ${s}`),
    ``,
    `## 问题 (${params.issues.length})`,
    ...params.issues.map(
      (i) => `- [${i.severity}] ${i.category}: ${i.message}`
    ),
    ``,
    params.retry.belowThreshold
      ? `⚠️ ${params.retry.reason}\n\n**需您拍板：同意后系统将自动定点修复可执行环节，不会全链路重造。**`
      : `✅ ${params.retry.reason}`,
  ];

  if (params.retry.retryTargets.length > 0) {
    lines.push(
      ``,
      `## 建议定点回流环节（需您拍板）`,
      ...params.retry.retryTargets.map(
        (t) =>
          `- **${t.label}**（${t.action}）${t.autoFixable ? " · 可自动修复" : " · 需导演/人工"}：${t.reason}`
      )
    );
  }

  return {
    json: JSON.stringify(payload, null, 2),
    markdown: lines.join("\n"),
  };
}
