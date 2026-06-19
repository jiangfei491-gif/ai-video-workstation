import OpenAI from "openai";
import {
  buildModelCandidates,
  formatOpenAIError,
  getOpenAIApiKey,
  isModelNotFoundError,
} from "@/app/lib/openai-key";
import { recordRequestError, recordUsage } from "@/app/lib/usage-tracker";

/**
 * 参考图 → 角色外观描述。
 * 为保证跨镜头一致性，重点抓「服装锚点」：发型/脸部特征/服装/配饰/体型，
 * 输出一段可直接注入提示词的英文外观描述。
 */

const SYSTEM = `你是角色设定师。观察人物参考图，提炼一段用于"跨镜头一致性"的英文外观描述。
重点锚定不变的视觉特征（顺序：性别年龄段 → 发型发色 → 脸部特征 → 服装（最关键）→ 配饰 → 体型）。
要求：一段连续英文短语，简洁具体、可直接拼入视频提示词，不要分行、不要解释、不要加引号。
例："a young man, short black hair, sharp jawline, wearing a worn olive military jacket and red scarf, leather boots, lean build"`;

export async function extractCharacterAppearance(
  imageDataUrl: string
): Promise<string> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error("未读取到 OPENAI_API_KEY，请配置 .env.local 后重启");

  const openai = new OpenAI({ apiKey });
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
              { type: "text", text: "提炼这个角色的外观锚点描述。" },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });
      const text = completion.choices[0]?.message?.content?.trim() ?? "";
      if (!text) throw new Error("模型未返回有效内容");
      recordUsage({
        model,
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
      }).catch((err) => console.error("[usage-tracker] record failed", err));
      return text.replace(/^["']|["']$/g, "").trim();
    } catch (err) {
      lastError = err;
      if (isModelNotFoundError(err)) continue;
      recordRequestError(model).catch(() => {});
      throw new Error(formatOpenAIError(err));
    }
  }

  recordRequestError(lastModel).catch(() => {});
  throw new Error(formatOpenAIError(lastError));
}
