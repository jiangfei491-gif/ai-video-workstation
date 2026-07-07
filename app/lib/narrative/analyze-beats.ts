import { directorChatCompletion } from "@/app/lib/director/director-chat";
import type { TokenCostLine } from "@/app/lib/cost-ledger/types";
import type { NarrativeBeat } from "./types";

function beatPrompt(targetDurationMinutes?: number): string {
  const rhythm =
    targetDurationMinutes != null && targetDurationMinutes > 0
      ? `目标成片约 ${targetDurationMinutes} 分钟——仅作整体节奏上下文，禁止用时长÷镜数推导 Beat 数量。`
      : "无固定时长——按剧情自然划分。";

  return `你是纪录片/叙事视频总编剧。阅读完整脚本，识别 Narrative Beat（完整微型剧情过程）。

${rhythm}

## Narrative Beat 是什么
一个 Beat = 一段完整的微型剧情过程或叙事意图，通常会在其内部再拆成多个视觉动作镜头。
例如（一个 Beat）：
「男人进入果园并开始检查苹果，随后发现异常。」

## 不是什么（禁止）
- 不是单个句子
- 不是单个段落标题
- 不是单个 informationChange / 单信息点
- 不是「进入果园」「看苹果」「发现异常」各自一个 Beat

## 何时才新开 Beat（必须明显）
- 剧情目标改变
- 场景明显改变
- 时间明显改变
- 主要人物目标改变
- 冲突阶段改变
- 一个完整信息段落结束，并进入新的叙事目的

禁止：按句号、换行、段落机械切 Beat。
禁止：根据 imageBudget、shotCount、时长公式计算 Beat 数。
禁止：扩写、改写原脚本——sourceText / narration 必须摘自原脚本。

## 每个 Beat 输出
- beatId: BEAT_001 递增
- sourceText: 覆盖本 Beat 全部相关原文（可跨多句/多段）
- beatGoal: 本 Beat 完整微型剧情意图（一句话概括过程，不是单动作）
- narrativePurpose: 叙事功能
- characters, environment, emotionalState, informationChange
- estimatedNarrationWeight: 0–1
- narration: Beat 级旁白（摘自原脚本）

8 分钟脚本通常约 8～20 个 Beat，不是 50+ 个。

只返回 JSON：{ "beats": [ ... ] }`;
}

function normalizeBeat(raw: Record<string, unknown>, index: number): NarrativeBeat {
  const chars = raw.characters;
  const beatGoal = String(raw.beatGoal ?? raw.narrativePurpose ?? "").trim();
  return {
    beatId: String(raw.beatId ?? `BEAT_${String(index + 1).padStart(3, "0")}`),
    sourceText: String(raw.sourceText ?? "").trim(),
    beatGoal,
    narrativePurpose: String(raw.narrativePurpose ?? beatGoal).trim(),
    characters: Array.isArray(chars)
      ? chars.map((c) => String(c).trim()).filter(Boolean)
      : String(chars ?? "")
          .split(/[,、]/)
          .map((s) => s.trim())
          .filter(Boolean),
    environment: String(raw.environment ?? "").trim(),
    emotionalState: String(raw.emotionalState ?? "").trim(),
    informationChange: String(raw.informationChange ?? "").trim(),
    estimatedNarrationWeight: Math.max(
      0.05,
      Math.min(1, Number(raw.estimatedNarrationWeight) || 0.1)
    ),
    narration: String(raw.narration ?? raw.sourceText ?? "").trim(),
  };
}

export async function analyzeNarrativeBeats(params: {
  title: string;
  script: string;
  targetDurationMinutes?: number;
}): Promise<{ beats: NarrativeBeat[]; usage: TokenCostLine }> {
  const { text, usage } = await directorChatCompletion(
    "narrative-beats",
    beatPrompt(params.targetDurationMinutes),
    `标题：${params.title}\n\n完整脚本：\n${params.script.trim()}`,
    { json: true, maxTokens: 8192 }
  );
  const parsed = JSON.parse(text) as { beats?: Record<string, unknown>[] };
  const beats = (parsed.beats ?? []).map(normalizeBeat).filter((b) => b.sourceText || b.beatGoal);
  if (!beats.length) throw new Error("未能分析 Narrative Beat");
  return { beats, usage };
}
