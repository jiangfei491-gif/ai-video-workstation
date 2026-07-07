import OpenAI from "openai";
import { recordTokenCost } from "@/app/lib/cost-ledger/unified";
import { TRANSITION_ENGINE_OPTIONS } from "@/app/lib/auto-edit/engines/transition-engine/ffmpeg-xfade";
import type { TransitionType } from "@/app/lib/auto-edit/types";
import type {
  ClipEffectKind,
  EffectDirectorTask,
  EffectPlan,
  EffectPresetId,
} from "./types";

function readEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function isDeepSeekAvailable(): boolean {
  return Boolean(readEnv("DEEPSEEK_API_KEY"));
}

const PRESET_LABELS: Record<EffectPresetId, string> = {
  documentary: "纪录片",
  viral: "短视频爆款",
  cinematic: "电影感",
  minimal: "极简",
  dynamic: "动感",
};

export function listEffectPresets(): { id: EffectPresetId; label: string }[] {
  return (Object.keys(PRESET_LABELS) as EffectPresetId[]).map((id) => ({
    id,
    label: PRESET_LABELS[id],
  }));
}

export function listTransitionCatalog(): { id: TransitionType; label: string }[] {
  return TRANSITION_ENGINE_OPTIONS.filter((t) => t.implemented).map((t) => ({
    id: t.id as TransitionType,
    label: t.label,
  }));
}

const CLIP_EFFECT_KINDS: ClipEffectKind[] = ["zoom", "blur", "flash", "shake", "motion", "glow"];

function pacingPreset(pacing: EffectDirectorTask["pacingProfile"]): EffectPresetId {
  if (pacing === "viral") return "viral";
  if (pacing === "cinematic") return "cinematic";
  return "documentary";
}

/** 规则回退：按节奏预设分配转场与镜头特效 */
export function recommendEffectPlanFallback(task: EffectDirectorTask): EffectPlan {
  const preset = task.preset ?? pacingPreset(task.pacingProfile);
  const clips = [...task.videoClips].sort((a, b) => a.startSec - b.startSec);
  const transitions: EffectPlan["transitions"] = [];
  const clipEffects: EffectPlan["clipEffects"] = [];

  const defaultType: TransitionType =
    task.defaultTransition ??
    (preset === "viral" ? "cut" : preset === "cinematic" ? "dip_black" : "crossfade");
  const defaultMs = task.defaultTransitionMs ?? (defaultType === "cut" ? 0 : 400);

  for (let i = 0; i < clips.length - 1; i++) {
    const after = clips[i]!;
    let type = defaultType;
    let durationMs = defaultMs;
    let rationale = `预设「${PRESET_LABELS[preset]}」默认转场`;

    if (preset === "viral" && i % 3 === 2) {
      type = "flash";
      durationMs = 200;
      rationale = "短视频节奏：每 3 镜闪白转场";
    } else if (preset === "cinematic" && i === Math.floor(clips.length / 2)) {
      type = "dip_black";
      durationMs = 600;
      rationale = "中段黑场强调叙事转折";
    } else if (preset === "dynamic" && i % 2 === 1) {
      type = "slide_left";
      durationMs = 350;
      rationale = "动感预设：交替滑入";
    }

    transitions.push({
      afterClipId: after.id,
      type,
      durationMs: type === "cut" ? 0 : durationMs,
      rationale,
    });
  }

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]!;
    if (preset === "viral" && i === 0) {
      clipEffects.push({
        clipId: clip.id,
        kind: "zoom",
        startSec: 0,
        durationSec: Math.min(1.2, clip.durationSec),
        intensity: 0.6,
        rationale: "开场推近抓注意力",
      });
    }
    if (preset === "cinematic" && i === clips.length - 1) {
      clipEffects.push({
        clipId: clip.id,
        kind: "glow",
        startSec: Math.max(0, clip.durationSec - 1),
        durationSec: Math.min(1, clip.durationSec),
        intensity: 0.4,
        rationale: "结尾柔光升华",
      });
    }
    if (preset === "dynamic" && i % 2 === 0) {
      clipEffects.push({
        clipId: clip.id,
        kind: "shake",
        startSec: clip.durationSec * 0.3,
        durationSec: Math.min(0.35, clip.durationSec * 0.2),
        intensity: 0.5,
        rationale: "动感预设：中段微抖",
      });
    }
  }

  return {
    preset,
    rationale: [`规则回退：${PRESET_LABELS[preset]} 模板`],
    transitions,
    clipEffects,
  };
}

/**
 * DeepSeek Effect Agent — 分析镜头并推荐转场 / 缩放 / 闪白 / 抖动等
 */
export async function runDeepSeekEffectPlan(
  task: EffectDirectorTask
): Promise<{ plan: EffectPlan; cost: number }> {
  const apiKey = readEnv("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return { plan: recommendEffectPlanFallback(task), cost: 0 };
  }

  const model = readEnv("DEEPSEEK_MODEL") ?? "deepseek-chat";
  const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });

  const payload = {
    durationSec: task.durationSec,
    pacingProfile: task.pacingProfile ?? "documentary",
    preset: task.preset,
    topic: task.topic ?? "",
    scriptExcerpt: (task.script ?? "").slice(0, 2000),
    videoClips: task.videoClips,
    subtitleHints: task.subtitleHints ?? [],
    voiceHints: task.voiceHints ?? [],
    allowedTransitions: listTransitionCatalog().map((t) => t.id),
    allowedClipEffects: CLIP_EFFECT_KINDS,
  };

  const system = `你是 AI Cut 特效中心 DeepSeek Effect Agent。只输出 JSON，不要 markdown。
职责：分析每个镜头衔接与画面节奏，推荐转场（transitions）与镜头特效（clipEffects）。
约束：
- afterClipId / clipId 必须来自 videoClips.id
- transition type 必须在 allowedTransitions 内
- clipEffects.kind 必须在 allowedClipEffects 内
- startSec 为相对 clip 内起点；durationSec > 0
- cut 转场 durationMs 必须为 0
输出格式：
{
  "preset": "documentary|viral|cinematic|minimal|dynamic",
  "rationale": ["整体说明"],
  "transitions": [{ "afterClipId", "type", "durationMs", "rationale" }],
  "clipEffects": [{ "clipId", "kind", "startSec", "durationSec", "intensity", "rationale" }]
}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload) },
    ],
    temperature: 0.35,
    max_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { plan: recommendEffectPlanFallback(task), cost: 0 };
  }

  const allowedTransitions = new Set(listTransitionCatalog().map((t) => t.id));
  const clipIds = new Set(task.videoClips.map((c) => c.id));

  const transitions = (Array.isArray(parsed.transitions) ? parsed.transitions : [])
    .map((row) => {
      const r = row as Record<string, unknown>;
      const type = String(r.type ?? "crossfade") as TransitionType;
      const afterClipId = String(r.afterClipId ?? "");
      if (!clipIds.has(afterClipId) || !allowedTransitions.has(type)) return null;
      const durationMs = type === "cut" ? 0 : Math.max(0, Number(r.durationMs) || 400);
      return {
        afterClipId,
        type,
        durationMs,
        rationale: String(r.rationale ?? "DeepSeek 推荐"),
      };
    })
    .filter((t): t is NonNullable<typeof t> => t != null);

  const clipEffects = (Array.isArray(parsed.clipEffects) ? parsed.clipEffects : [])
    .map((row) => {
      const r = row as Record<string, unknown>;
      const clipId = String(r.clipId ?? "");
      const kind = String(r.kind ?? "") as ClipEffectKind;
      if (!clipIds.has(clipId) || !CLIP_EFFECT_KINDS.includes(kind)) return null;
      return {
        clipId,
        kind,
        startSec: Math.max(0, Number(r.startSec) || 0),
        durationSec: Math.max(0.1, Number(r.durationSec) || 0.5),
        intensity: Math.min(1, Math.max(0, Number(r.intensity) || 0.5)),
        rationale: String(r.rationale ?? "DeepSeek 推荐"),
      };
    })
    .filter((e): e is NonNullable<typeof e> => e != null);

  const presetRaw = String(parsed.preset ?? task.preset ?? "documentary");
  const preset = (
    listEffectPresets().some((p) => p.id === presetRaw) ? presetRaw : "documentary"
  ) as EffectPresetId;

  const plan: EffectPlan =
    transitions.length > 0 || clipEffects.length > 0
      ? {
          preset,
          rationale: Array.isArray(parsed.rationale)
            ? parsed.rationale.map(String)
            : ["DeepSeek 特效方案"],
          transitions,
          clipEffects,
        }
      : recommendEffectPlanFallback(task);

  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;
  const cost = (inputTokens * 0.28 + outputTokens * 0.42) / 1_000_000;
  recordTokenCost("特效中心", "特效分析", "deepseek", "deepseek-chat", inputTokens, outputTokens);

  return { plan, cost };
}

export { PRESET_LABELS };
