import OpenAI from "openai";
import {
  buildModelCandidates,
  formatOpenAIError,
  getOpenAIApiKey,
  isModelNotFoundError,
} from "@/app/lib/openai-key";
import { recordRequestError, recordUsage } from "@/app/lib/usage-tracker";

/**
 * 视频 → Prompt 反推（VideoToPrompt）。
 * 输入同一段视频按时间顺序抽取的多帧，综合理解"动作时序 + 镜头运动"，
 * 反推出一条可直接用于 Veo 文生视频的英文提示词。
 */

const SYSTEM = `你是顶级 AI 视频提示词工程师，擅长从成片反推提示词（VideoToPrompt）。
下面是同一段视频按时间先后抽取的若干帧。请综合所有帧，输出一条可直接用于 Google Veo 文生视频的英文提示词。

必须覆盖：
- 主体与外观（subject & appearance）
- 动作与时序（action over time，帧间发生了什么变化）
- 镜头运动（camera movement：如 push in / pull back / pan / tilt / orbit / tracking / handheld / static）
- 景别（shot size）
- 光线与氛围（lighting & mood）
- 画面风格（visual style）

要求：一段连贯英文，具体可执行，约 50-90 词；竖屏 9:16，连贯自然运动；
只返回提示词本身，不要解释、不要分行、不要加引号。`;

export async function extractPromptFromVideoFrames(
  frameDataUrls: string[]
): Promise<string> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error("未读取到 OPENAI_API_KEY，请配置 .env.local 后重启");
  if (frameDataUrls.length === 0) throw new Error("没有可分析的视频帧");

  const openai = new OpenAI({ apiKey });
  const models = [...new Set(["gpt-4.1", "gpt-4o", ...buildModelCandidates()])].filter(
    (m) => !m.includes("mini")
  );
  let lastError: unknown;
  let lastModel = models[0] ?? "gpt-4.1";

  const imageParts = frameDataUrls.map((url) => ({
    type: "image_url" as const,
    image_url: { url },
  }));

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
              {
                type: "text",
                text: `这是视频按时间顺序的 ${frameDataUrls.length} 帧，请反推完整视频提示词。`,
              },
              ...imageParts,
            ],
          },
        ],
        temperature: 0.4,
        max_tokens: 500,
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
