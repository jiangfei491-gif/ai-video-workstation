import { directorChatCompletion } from "@/app/lib/director/director-chat";
import type { BuildEditInput, EditPlan, EditSequence, PacingProfile, TransitionType } from "./types";
import {
  applyNarrativeOrder,
  buildDefaultEditSequence,
  rebuildTransitions,
} from "./build-sequence";

const SYSTEM = `你是 AI 视频自动剪辑导演。根据脚本、分镜、画布分区与素材情况，输出剪辑方案 JSON。

规则：
1. playOrder 必须包含所有 clip key，每个 key 恰好出现一次
2. durationSec 可在原分镜时长基础上微调（0.5～120 秒），总时长尽量贴合口播节奏
3. 同一 sectionId 的镜内节奏一致；幕与幕之间可用 crossfade、dip_black、slide_left、wipe_right 等
4. sourceKind=missing 的镜 durationSec 设为 0 并在 aiNotes 标注缺口
5. 纪录片 documentary 偏慢，爆款 viral 偏快，电影 cinematic 强调情绪镜延长
6. clipAdjustments 必须包含 reason（中文），解释为什么这样剪，例如「剧情高潮」「人物表情最好」「节奏更自然」

只返回 JSON：
{
  "playOrder": ["shot-0", "shot-1"],
  "clipAdjustments": [{ "key": "shot-0", "durationSec": 4.5, "reason": "开场钩子，略延长停留", "tags": ["hook"] }],
  "transitions": [{ "fromKey": "shot-0", "toKey": "shot-1", "type": "crossfade", "durationMs": 300, "reason": "情绪过渡" }],
  "pacingProfile": "documentary|viral|cinematic",
  "sectionPacing": { "sectionId": "开场慢、主体快" },
  "aiNotes": ["说明1", "说明2"]
}`;

type AiEditResponse = {
  playOrder?: string[];
  clipAdjustments?: { key: string; durationSec: number; reason?: string; tags?: string[] }[];
  transitions?: {
    fromKey: string;
    toKey: string;
    type: TransitionType;
    durationMs?: number;
    reason?: string;
  }[];
  pacingProfile?: PacingProfile;
  sectionPacing?: Record<string, string>;
  aiNotes?: string[];
};

export async function generateEditPlan(
  input: BuildEditInput,
  basePacing: PacingProfile = "documentary"
): Promise<EditPlan> {
  let base = buildDefaultEditSequence(input, basePacing);
  base = applyNarrativeOrder(base, input.narrativeEdges);

  const payload = {
    topic: input.topic,
    scriptExcerpt: (input.script ?? "").slice(0, 4000),
    clips: base.playOrder.map((k) => {
      const c = base.clips[k];
      return {
        key: k,
        durationSec: c.durationSec,
        sourceKind: c.sourceKind,
        sectionId: c.sectionId,
        hasCast: c.hasCast,
        hint: c.storyboardHint,
      };
    }),
    sections: input.sections.map((s) => ({ id: s.id, title: s.title })),
    narrativeEdges: input.narrativeEdges,
    pacingProfile: basePacing,
  };

  try {
    const { text, model, usage } = await directorChatCompletion(
      "edit-plan",
      SYSTEM,
      JSON.stringify(payload, null, 2),
      { json: true, maxTokens: 2500 }
    );
    const parsed = JSON.parse(text) as AiEditResponse;
    return mergeAiPlan(base, parsed, model, usage);
  } catch {
    return {
      ...base,
      aiNotes: ["AI 方案生成失败，已使用默认顺序与分镜时长"],
      sectionPacing: {},
    };
  }
}

function mergeAiPlan(
  base: EditSequence,
  ai: AiEditResponse,
  model?: string,
  usage?: { model: string; inputTokens: number; outputTokens: number; costUsd: number }
): EditPlan {
  const playOrder =
    ai.playOrder?.filter((k) => base.clips[k])?.length === base.playOrder.length
      ? ai.playOrder!
      : base.playOrder;

  const clips = { ...base.clips };
  const clipRationale: NonNullable<EditPlan["clipRationale"]> = {};
  for (const adj of ai.clipAdjustments ?? []) {
    if (clips[adj.key]) {
      clips[adj.key] = {
        ...clips[adj.key],
        durationSec: Math.max(0.5, adj.durationSec),
      };
      clipRationale[adj.key] = {
        durationSec: adj.durationSec,
        reason: adj.reason?.trim() || "AI 建议时长",
        tags: adj.tags,
      };
    }
  }

  let transitions = base.transitions;
  const transitionRationale: NonNullable<EditPlan["transitionRationale"]> = {};
  if (ai.transitions?.length) {
    transitions = ai.transitions.map((t) => {
      const key = `${t.fromKey}->${t.toKey}`;
      if (t.reason?.trim()) transitionRationale[key] = t.reason.trim();
      return {
        fromKey: t.fromKey,
        toKey: t.toKey,
        type: (t.type ?? "cut") as TransitionType,
        durationMs: t.durationMs ?? (t.type === "cut" ? 0 : 400),
      };
    });
  }

  const merged = rebuildTransitions({
    ...base,
    playOrder,
    clips,
    transitions,
    pacingProfile: ai.pacingProfile ?? base.pacingProfile,
  });

  return {
    ...merged,
    aiNotes: ai.aiNotes ?? [],
    sectionPacing: ai.sectionPacing ?? {},
    clipRationale,
    transitionRationale,
    model,
    usage,
  };
}

export function editPlanToSequence(plan: EditPlan): EditSequence {
  const { aiNotes: _a, sectionPacing: _s, model: _m, usage: _u, ...seq } = plan;
  return seq;
}
