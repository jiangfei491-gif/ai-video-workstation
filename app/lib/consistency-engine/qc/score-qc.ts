import OpenAI from "openai";
import { buildModelCandidates, getOpenAIApiKey } from "@/app/lib/openai-key";
import { recordUsage } from "@/app/lib/usage-tracker";
import { estimateCostUsd } from "@/app/lib/cost-ledger/pricing";
import type { ApiUsage } from "@/app/lib/cost-ledger/types";

/** Tier 2 — 10 维评分（筛选 FLUX 草稿，成本低） */
export type ScoreDimension =
  | "promptAdherence"
  | "character"
  | "scene"
  | "style"
  | "composition"
  | "lighting"
  | "clarity"
  | "realism"
  | "aiArtifacts"
  | "videoUsability";

export type ScoreBreakdown = Record<ScoreDimension, number> & {
  composite: number;
};

export type ScoreQCResult = {
  passed: boolean;
  scores: ScoreBreakdown;
  failedDimensions: ScoreDimension[];
  eliminate: boolean;
  hints: string[];
  usage?: ApiUsage;
};

export type ScoreQCInput = {
  imageBuffer: Buffer;
  composedPrompt: string;
  referenceBuffers?: Buffer[];
  threshold?: number;
  /** FLUX 草稿轮：人物权重降低 */
  draftRound?: boolean;
  /** ImageTask 多 Shot 复用上下文 */
  imageTaskContext?: {
    primaryShotId: string;
    supportingShotIds: string[];
    actionCoverage: string[];
    visualFocus: string[];
    cameraIntent: string;
  };
};

const SCORE_SYSTEM = `你是 AI 视频分镜筛选员。对草稿图从 10 个维度打分 0-100（越高越好；aiArtifacts 表示 AI 痕迹，100=无痕迹）：
promptAdherence, character, scene, style, composition, lighting, clarity, realism, aiArtifacts, videoUsability

只返回 JSON：
{
  "promptAdherence": 98,
  "character": 85,
  "scene": 90,
  "style": 92,
  "composition": 93,
  "lighting": 88,
  "clarity": 91,
  "realism": 87,
  "aiArtifacts": 90,
  "videoUsability": 94,
  "hints": ["optional improvement hints"]
}`;

function bufferToDataUrl(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeScores(raw: Record<string, unknown>): ScoreBreakdown {
  const dims: ScoreDimension[] = [
    "promptAdherence",
    "character",
    "scene",
    "style",
    "composition",
    "lighting",
    "clarity",
    "realism",
    "aiArtifacts",
    "videoUsability",
  ];
  const scores = {} as Record<ScoreDimension, number>;
  for (const d of dims) {
    scores[d] = clamp(Number(raw[d] ?? 0));
  }

  const weights: Record<ScoreDimension, number> = {
    promptAdherence: 0.15,
    character: 0.12,
    scene: 0.1,
    style: 0.1,
    composition: 0.12,
    lighting: 0.08,
    clarity: 0.08,
    realism: 0.08,
    aiArtifacts: 0.07,
    videoUsability: 0.1,
  };

  let composite = 0;
  for (const d of dims) {
    composite += scores[d] * weights[d];
  }

  return { ...scores, composite: Math.round(composite * 10) / 10 };
}

function draftWeights(): Record<ScoreDimension, number> {
  return {
    promptAdherence: 0.2,
    character: 0.06,
    scene: 0.08,
    style: 0.1,
    composition: 0.18,
    lighting: 0.1,
    clarity: 0.1,
    realism: 0.06,
    aiArtifacts: 0.06,
    videoUsability: 0.16,
  };
}

function compositeWithWeights(
  scores: Record<ScoreDimension, number>,
  weights: Record<ScoreDimension, number>
): number {
  let c = 0;
  for (const d of Object.keys(weights) as ScoreDimension[]) {
    c += scores[d] * weights[d];
  }
  return Math.round(c * 10) / 10;
}

export async function runScoreQC(input: ScoreQCInput): Promise<ScoreQCResult> {
  const threshold = input.threshold ?? 90;
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    const stub = normalizeScores({
      promptAdherence: 92,
      character: 88,
      scene: 88,
      style: 88,
      composition: 90,
      lighting: 88,
      clarity: 90,
      realism: 88,
      aiArtifacts: 85,
      videoUsability: 90,
    });
    return {
      passed: true,
      scores: stub,
      failedDimensions: [],
      eliminate: false,
      hints: ["未配置 API，跳过评分"],
    };
  }

  const openai = new OpenAI({ apiKey });
  const models = ["gpt-4o-mini", ...buildModelCandidates().filter((m) => m.includes("mini"))];

  const imageTaskBlock = input.imageTaskContext
    ? [
        "\n\nImageTask 复用上下文（此图需同时服务多个 Narrative Shot）：",
        `Primary Shot: ${input.imageTaskContext.primaryShotId}`,
        input.imageTaskContext.supportingShotIds.length
          ? `Supporting Shots: ${input.imageTaskContext.supportingShotIds.join(", ")}`
          : "",
        `Action coverage: ${input.imageTaskContext.actionCoverage.join(" | ")}`,
        `Visual focus: ${input.imageTaskContext.visualFocus.join(" | ")}`,
        `Camera intent: ${input.imageTaskContext.cameraIntent}`,
        "若图片只能满足 primary 但明显无法满足 supportingShots，降低 composition 与 videoUsability，并在 hints 给出 repairHint。",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `评估草稿分镜图。\n\n锁定 Prompt：\n${input.composedPrompt.slice(0, 1500)}${imageTaskBlock}`,
    },
    { type: "image_url", image_url: { url: bufferToDataUrl(input.imageBuffer) } },
  ];
  for (const ref of input.referenceBuffers?.slice(0, 2) ?? []) {
    userContent.push({
      type: "image_url",
      image_url: { url: bufferToDataUrl(ref) },
    });
  }

  let lastError: unknown;
  for (const model of models) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SCORE_SYSTEM },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 600,
        response_format: { type: "json_object" },
      });
      const text = completion.choices[0]?.message?.content?.trim() ?? "{}";
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const base = normalizeScores(parsed);
      const scores = input.draftRound
        ? {
            ...base,
            composite: compositeWithWeights(base, draftWeights()),
          }
        : base;

      const dims: ScoreDimension[] = [
        "promptAdherence",
        "character",
        "scene",
        "style",
        "composition",
        "lighting",
        "clarity",
        "realism",
        "aiArtifacts",
        "videoUsability",
      ];
      const failedDimensions = dims.filter((d) => scores[d] < threshold - 5);
      const passed = scores.composite >= threshold;

      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;

      recordUsage({ model, inputTokens, outputTokens }).catch(() => {});

      return {
        passed,
        scores,
        failedDimensions,
        eliminate: !passed,
        hints: Array.isArray(parsed.hints)
          ? (parsed.hints as string[]).slice(0, 5)
          : [],
        usage: {
          model,
          inputTokens,
          outputTokens,
          costUsd: estimateCostUsd(model, inputTokens, outputTokens),
        },
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** 多张草稿中选综合分最高 */
export function pickBestScored<T extends { score: ScoreQCResult }>(
  items: T[]
): T | null {
  if (items.length === 0) return null;
  return [...items].sort((a, b) => b.score.scores.composite - a.score.scores.composite)[0];
}
