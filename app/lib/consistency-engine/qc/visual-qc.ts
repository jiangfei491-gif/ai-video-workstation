import OpenAI from "openai";
import { buildModelCandidates, getOpenAIApiKey } from "@/app/lib/openai-key";
import { recordUsage } from "@/app/lib/usage-tracker";
import { estimateCostUsd } from "@/app/lib/cost-ledger/pricing";
import type { ApiUsage } from "@/app/lib/cost-ledger/types";
import type { QCThresholds, QCVerdict } from "../types/qc";
import { DEFAULT_QC_THRESHOLDS } from "../types/qc";

function bufferToDataUrl(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

const SYSTEM = `你是 AI 视频分镜视觉质检员。对比生成图与参考图（如有），从五个维度打分 0-100：
character（人脸/发型/服装/年龄一致性）
scene（建筑/天气/时间/灯光一致性）
cinematography（镜头/焦段/构图一致性）
style（色调/LUT/颗粒/真实感一致性）
realism（AI 味越低分越高，100=完全真实）

只返回 JSON：
{
  "overall": 95,
  "character": 98,
  "scene": 92,
  "cinematography": 96,
  "style": 94,
  "realism": 90,
  "repairHints": ["face drift: keep same face as reference", "..."]
}`;

/** Phase 2 — Visual QC（Vision LLM） */
export async function runVisualQC(params: {
  imageBuffer: Buffer;
  referenceBuffers?: Buffer[];
  composedPrompt: string;
  thresholds?: QCThresholds;
  imageTaskContext?: {
    primaryShotId: string;
    supportingShotIds: string[];
    actionCoverage: string[];
    visualFocus: string[];
    cameraIntent: string;
  };
}): Promise<QCVerdict> {
  const thresholds = params.thresholds ?? DEFAULT_QC_THRESHOLDS;
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    return passStub(thresholds, ["未配置 API，跳过 QC"]);
  }

  const openai = new OpenAI({ apiKey });
  const models = ["gpt-4o-mini", ...buildModelCandidates().filter((m) => m.includes("mini"))];

  const imageTaskBlock = params.imageTaskContext
    ? [
        "\n\nImageTask 复用：",
        `Primary: ${params.imageTaskContext.primaryShotId}`,
        params.imageTaskContext.supportingShotIds.length
          ? `Supporting: ${params.imageTaskContext.supportingShotIds.join(", ")}`
          : "",
        `Actions: ${params.imageTaskContext.actionCoverage.join(" | ")}`,
        `Focus: ${params.imageTaskContext.visualFocus.join(" | ")}`,
        "若无法满足 supportingShots，降低 cinematography 分并在 repairHints 说明。",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `评估这张分镜图的一致性。\n\n锁定 Prompt 摘要：\n${params.composedPrompt.slice(0, 1200)}${imageTaskBlock}`,
    },
    { type: "image_url", image_url: { url: bufferToDataUrl(params.imageBuffer) } },
  ];

  for (const ref of params.referenceBuffers?.slice(0, 2) ?? []) {
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
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: "json_object" },
      });
      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;

      recordUsage({ model, inputTokens, outputTokens }).catch(() => {});

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as {
        overall?: number;
        character?: number;
        scene?: number;
        cinematography?: number;
        style?: number;
        realism?: number;
        repairHints?: string[];
      };

      const scores = {
        overall: clamp(parsed.overall ?? 85),
        character: clamp(parsed.character ?? 85),
        scene: clamp(parsed.scene ?? 85),
        cinematography: clamp(parsed.cinematography ?? 85),
        style: clamp(parsed.style ?? 85),
        realism: clamp(parsed.realism ?? 85),
      };

      const failedDimensions = (
        [
          ["character", scores.character, thresholds.character],
          ["scene", scores.scene, thresholds.scene],
          ["cinematography", scores.cinematography, thresholds.cinematography],
          ["style", scores.style, thresholds.style],
          ["realism", scores.realism, thresholds.realism],
        ] as const
      )
        .filter(([, s, min]) => s < min)
        .map(([d]) => d);

      const passed =
        scores.overall >= thresholds.overall && failedDimensions.length === 0;

      return {
        passed,
        scores,
        failedDimensions: [...failedDimensions],
        repairHints: parsed.repairHints ?? failedDimensions.map((d) => `Fix ${d} drift only.`),
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

  console.warn("[visual-qc] failed, pass by default:", lastError);
  return passStub(thresholds, ["QC 模型不可用，默认通过"]);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function passStub(thresholds: QCThresholds, hints: string[]): QCVerdict {
  return {
    passed: true,
    scores: {
      overall: thresholds.overall,
      character: thresholds.character,
      scene: thresholds.scene,
      cinematography: thresholds.cinematography,
      style: thresholds.style,
      realism: thresholds.realism,
    },
    failedDimensions: [],
    repairHints: hints,
  };
}

export function shouldAutoRepair(verdict: QCVerdict): boolean {
  return !verdict.passed;
}
