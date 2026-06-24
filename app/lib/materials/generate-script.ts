import { chatCompletion } from "@/app/lib/openai-key";
import type { Material } from "./types";

const SYSTEM = `你是顶级短视频编剧。根据用户给的素材（及其结构化分析），写一条可以直接配音的中文口播脚本。

要求：
- 结构：钩子（前3秒抓人）→ 铺垫 → 冲突 → 转折 → 高潮 → 结局升华
- 口语化、有节奏、信息密度高，适合竖屏短视频/Shorts
- 只输出脚本正文（一段段口播文案），不要标注"钩子/铺垫"这些字样，不要解释`;

export async function generateMaterialScript(material: Material): Promise<string> {
  const a = material.analysis;
  const analysisBlock = a
    ? `\n\n【已分析要点】概括：${a.summary}；冲突：${a.conflict}；转折：${a.twist}；高潮：${a.climax}；结局：${a.ending}；情绪：${a.emotion}`
    : "";
  const { text } = await chatCompletion(
    SYSTEM,
    `标题：${material.title}\n正文：${material.content || "（仅标题）"}${analysisBlock}`,
    { maxTokens: 2000 }
  );
  return text.trim();
}
