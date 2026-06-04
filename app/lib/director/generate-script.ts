import { directorChatCompletion } from "./director-chat";

export async function generateScript(
  topic: string,
  title: string
): Promise<string> {
  const { text } = await directorChatCompletion(
    "script-advanced",
    `你是 AI 原生视频编剧。根据主题和标题撰写约 60 秒中文口播脚本。
结构：钩子(5s) → 痛点 → 方案 → 行动号召。
纯口播文本，不要镜头说明，分段用空行分隔，总字数 180-260 字。`,
    `主题：${topic}\n标题：${title}`,
    { maxTokens: 1500 }
  );

  const script = text.trim();
  if (!script) throw new Error("未能生成脚本");
  return script;
}
