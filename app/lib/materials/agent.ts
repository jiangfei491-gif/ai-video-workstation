import OpenAI from "openai";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

/** Agent 联网搜索找到的候选素材 */
export type FoundMaterial = {
  title: string;
  sourceUrl: string;
  sourceSite: string;
  content: string;
};

function extractJsonArray(text: string): Record<string, unknown>[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("未能从搜索结果解析出 JSON 数组");
  }
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>[];
}

/**
 * 素材 Agent —— 用 OpenAI 的联网搜索（Responses API web_search 工具）
 * 自己去全网找符合要求的真实素材，返回结构化候选列表。
 */
export async function findMaterials(params: {
  task: string;
  count: number;
  category: string;
}): Promise<FoundMaterial[]> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error("未配置 OPENAI_API_KEY");

  const openai = new OpenAI({ apiKey });
  const count = Math.max(1, Math.min(20, Math.floor(params.count) || 5));

  const instruction = `你是短视频选题猎手。使用联网搜索，去全网找 ${count} 篇真实、可考证、适合做短视频的素材。

任务：${params.task}
类别倾向：${params.category}

筛选标准：要有故事性（人物 / 冲突 / 转折 / 结局），优先权威来源（维基百科 / 正规媒体 / 知名博客 / 高赞论坛帖）。

对每一篇输出：
- title：中文标题
- sourceUrl：真实可访问的网址
- sourceSite：来源站点名
- content：用中文概述该素材 300-500 字，覆盖人物、冲突、转折、结局

只返回一个 JSON 数组，不要任何解释、不要代码块标记：
[{"title":"","sourceUrl":"","sourceSite":"","content":""}]`;

  const res = await openai.responses.create({
    model: "gpt-4.1",
    tools: [{ type: "web_search_preview" }],
    input: instruction,
  });

  const text = (res.output_text ?? "").trim();
  if (!text) throw new Error("搜索未返回内容");

  const arr = extractJsonArray(text);
  return arr
    .slice(0, count)
    .map((x) => ({
      title: String(x.title ?? "").trim(),
      sourceUrl: String(x.sourceUrl ?? "").trim(),
      sourceSite: String(x.sourceSite ?? "").trim(),
      content: String(x.content ?? "").trim(),
    }))
    .filter((m) => m.title);
}
