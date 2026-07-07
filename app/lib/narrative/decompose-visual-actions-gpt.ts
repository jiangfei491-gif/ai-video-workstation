import { directorChatCompletion } from "@/app/lib/director/director-chat";
import type { TokenCostLine } from "@/app/lib/cost-ledger/types";
import type { NarrativeBeat } from "./types";
import type { VisualActionUnit } from "./visual-action-types";

const DECOMPOSE_PROMPT = `你是视觉动作分解导演。将 Narrative Beat 过程分解为 VisualActionUnit[]。

## 铁律
- visibleAction 必须是摄像机可直接拍摄的动作或状态变化（≤24 中文字）
- 禁止抽象叙事：「发现问题」「意识到」「故事改变」等
- 禁止把 sourceText 原句复制为 visibleAction
- 复合动作必须拆成多个 Unit

## Unit 字段
unitId, beatId, subject, visibleAction, object?, visualResult?, reaction?,
visualFocus, spatialContext, purpose(establish|action|detail|reaction|reveal|transition),
suggestedShotScale(extreme_wide|wide|medium|close_up|extreme_close_up),
suggestedAngle(eye_level|low|high|over_shoulder|pov|top_down), sourceRef

reaction 类 Unit 的 visibleAction 也必须是可见状态（如「手部停止」「眉头收紧」），禁止空 action。

只返回 JSON：{ "units": [ ... ] }`;

function normalizeUnit(
  raw: Record<string, unknown>,
  beat: NarrativeBeat,
  index: number
): VisualActionUnit | null {
  const visibleAction = String(raw.visibleAction ?? "").trim();
  if (!visibleAction || visibleAction.length > 30) return null;

  let reaction: VisualActionUnit["reaction"];
  if (raw.reaction && typeof raw.reaction === "object") {
    const r = raw.reaction as Record<string, unknown>;
    reaction = {
      subject: String(r.subject ?? beat.characters[0] ?? "男人"),
      visibleBehavior: String(r.visibleBehavior ?? ""),
      emotionIntent: r.emotionIntent ? String(r.emotionIntent) : undefined,
    };
  } else if (typeof raw.reaction === "string" && raw.reaction.trim()) {
    reaction = {
      subject: String(raw.subject ?? beat.characters[0] ?? "男人"),
      visibleBehavior: raw.reaction.trim(),
    };
  }

  return {
    unitId: String(raw.unitId ?? `${beat.beatId}_U${String(index + 1).padStart(3, "0")}`),
    beatId: beat.beatId,
    subject: String(raw.subject ?? beat.characters[0] ?? "男人").trim(),
    visibleAction,
    startState: raw.startState ? String(raw.startState) : undefined,
    endState: raw.endState ? String(raw.endState) : undefined,
    object: raw.object ? String(raw.object) : undefined,
    location: raw.location ? String(raw.location) : undefined,
    evidenceOf: raw.evidenceOf ? String(raw.evidenceOf) : String(raw.sourceRef ?? ""),
    reaction,
    visualFocus: String(raw.visualFocus ?? visibleAction.slice(0, 12)).trim(),
    purpose: (String(raw.purpose ?? "action") as VisualActionUnit["purpose"]) || "action",
    sourceRef: String(raw.sourceRef ?? "").trim(),
    sourceIntent: raw.sourceIntent ? String(raw.sourceIntent) : undefined,
  };
}

export async function decomposeVisualActionsGpt(params: {
  title: string;
  beat: NarrativeBeat;
  process: {
    actionProcess: string[];
    reactionProcess: string[];
    informationReveal: string;
  };
}): Promise<{ units: VisualActionUnit[]; usage: TokenCostLine }> {
  const user = [
    `标题：${params.title}`,
    `Beat：${params.beat.beatId}`,
    `beatGoal：${params.beat.beatGoal}`,
    `环境：${params.beat.environment}`,
    `actionProcess：${JSON.stringify(params.process.actionProcess)}`,
    `reactionProcess：${JSON.stringify(params.process.reactionProcess)}`,
    `informationReveal：${params.process.informationReveal}`,
    `脚本节选：\n${params.beat.sourceText.slice(0, 800)}`,
  ].join("\n");

  const { text, usage } = await directorChatCompletion(
    "narrative-shots",
    DECOMPOSE_PROMPT,
    user,
    { json: true, maxTokens: 8192 }
  );

  const parsed = JSON.parse(text) as { units?: Record<string, unknown>[] };
  const units = (parsed.units ?? [])
    .map((raw, i) => normalizeUnit(raw, params.beat, i))
    .filter((u): u is VisualActionUnit => u != null);

  if (!units.length) throw new Error(`Beat ${params.beat.beatId} 未生成 VisualActionUnit`);
  return { units, usage };
}
