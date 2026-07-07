import { directorChatCompletion } from "./director-chat";
import type { TokenCostLine } from "@/app/lib/cost-ledger/types";
import { emptyTokenLine } from "@/app/lib/cost-ledger/merge";

export async function generateTitle(
  topic: string
): Promise<{ title: string; usage: TokenCostLine }> {
  const { text, usage } = await directorChatCompletion(
    "title",
    `你是短视频标题专家。根据用户主题生成 1 条高点击率中文标题。
返回 JSON：{"title":"标题文本"}
要求：口语化、有悬念或利益点，15-30 字，不要编号前缀。`,
    topic,
    { json: true }
  );

  const parsed = JSON.parse(text) as { title?: string };
  const title = parsed.title?.trim();
  if (!title) throw new Error("未能生成标题");
  return { title, usage };
}
