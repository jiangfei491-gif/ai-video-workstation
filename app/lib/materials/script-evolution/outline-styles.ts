import type { DurationPlan } from "./duration-config";
import { buildDurationPromptBlock } from "./duration-config";
import type { ScriptStyleId } from "./types";
import { styleSystemHint } from "./styles";

export function buildOutlineSystem(style: ScriptStyleId, plan: DurationPlan): string {
  const hint = styleSystemHint(style);
  const durationBlock = buildDurationPromptBlock(plan);
  return `你是顶级视频编剧策划。根据素材撰写「脚本大纲」（不是完整口播正文）。

风格要求：${hint}

【时长与结构】
${durationBlock}

大纲要求：
- 必须包含「黄金3秒」钩子设计（单独列出）
- 按章节列出：章标题 + 每章 2～4 句要点（人物、冲突、转折、信息点）
- 体现上述故事结构，不是单纯堆字数
- 总篇幅约 350～700 字（大纲层）

只输出大纲正文，不要 JSON，不要解释。`;
}

export function buildExpandSystem(style: ScriptStyleId, plan: DurationPlan): string {
  const hint = styleSystemHint(style);
  const durationBlock = buildDurationPromptBlock(plan);
  return `你是顶级中文视频编剧。根据给定大纲扩写为可直接配音的完整口播脚本。

风格要求：${hint}

【时长与结构】
${durationBlock}

扩写要求：
- 严格按大纲章节展开，字数目标约 ${plan.targetWordCount} 字（±10%）
- 口语化、有节奏、适合 ${plan.formatHint}
- 只输出脚本正文，不要标注章节名，不要解释`;
}
