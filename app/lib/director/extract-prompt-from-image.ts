import OpenAI from "openai";
import {
  buildModelCandidates,
  formatOpenAIError,
  getOpenAIApiKey,
  isModelNotFoundError,
} from "@/app/lib/openai-key";
import { recordRequestError, recordUsage } from "@/app/lib/usage-tracker";
import { EMPTY_BLUEPRINT, type PromptBlueprint } from "./prompt-blueprint";

/**
 * 参考图 → Prompt 反推。
 * 用 GPT-4.1 视觉读图，按「填空法」拆出 景别/主体/动作/场景/光线/风格，
 * 让用户从"我想要类似这张图的感觉"直接起步，而不必先把感觉翻译成文字。
 */

const SYSTEM = `你是顶级 AI 视频提示词工程师，擅长「反推提示词（SD PROMPT SCAN）」。
观察用户提供的参考图，按电影分镜的「填空法」拆解为结构化字段，用于生成 Google Veo 视频提示词。

逐项分析：
- shot: 景别与机位（如 close-up shot / wide shot / aerial drone shot / low-angle shot）
- subject: 主体是谁/是什么（外观、服装、关键特征，简洁英文短语）
- action: 主体正在做的动作或可延伸出的自然动态（英文）
- scene: 场景与环境（地点、背景、时间、天气，英文）
- lighting: 光线与氛围（如 golden hour warm light / neon-lit night / soft diffused light，英文）
- style: 视觉风格（如 cinematic photorealistic / vintage film grain / cyberpunk，英文）

所有字段值用英文，简洁精准、可直接拼入提示词。无法判断的字段留空字符串。
只返回 JSON：{"shot":"","subject":"","action":"","scene":"","lighting":"","style":""}`;

export async function extractPromptFromImage(
  imageDataUrl: string
): Promise<PromptBlueprint> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error("未读取到 OPENAI_API_KEY，请配置 .env.local 后重启");

  const openai = new OpenAI({ apiKey });
  // 仅用支持视觉的模型
  const models = [...new Set(["gpt-4.1", "gpt-4o", ...buildModelCandidates()])].filter(
    (m) => !m.includes("mini")
  );
  let lastError: unknown;
  let lastModel = models[0] ?? "gpt-4.1";

  for (const model of models) {
    lastModel = model;
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "反推这张参考图的视频提示词字段。" },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        temperature: 0.4,
        max_tokens: 700,
        response_format: { type: "json_object" },
      });
      const text = completion.choices[0]?.message?.content?.trim() ?? "";
      if (!text) throw new Error("模型未返回有效内容");
      recordUsage({
        model,
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
      }).catch((err) => console.error("[usage-tracker] record failed", err));

      const raw = JSON.parse(text) as Record<string, unknown>;
      return {
        shot: String(raw.shot ?? "").trim(),
        subject: String(raw.subject ?? "").trim(),
        action: String(raw.action ?? "").trim(),
        scene: String(raw.scene ?? "").trim(),
        lighting: String(raw.lighting ?? "").trim(),
        style: String(raw.style ?? "").trim(),
      };
    } catch (err) {
      lastError = err;
      if (isModelNotFoundError(err)) continue;
      recordRequestError(model).catch(() => {});
      throw new Error(formatOpenAIError(err));
    }
  }

  recordRequestError(lastModel).catch(() => {});
  // 全部失败时返回空蓝图，避免前端崩
  void EMPTY_BLUEPRINT;
  throw new Error(formatOpenAIError(lastError));
}
