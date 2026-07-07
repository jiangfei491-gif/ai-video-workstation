import type { Material } from "../types";

export function buildMaterialUserPrompt(material: Material): string {
  const a = material.analysis;
  const analysisBlock = a
    ? `\n\n【已分析要点】
概括：${a.summary}
人物：${a.characters}
地点：${a.location}
时间：${a.timeline}
冲突：${a.conflict}
转折：${a.twist}
高潮：${a.climax}
结局：${a.ending}
情绪：${a.emotion}`
    : "";

  return `标题：${material.title}
正文：${material.content || "（仅标题）"}${analysisBlock}`;
}
