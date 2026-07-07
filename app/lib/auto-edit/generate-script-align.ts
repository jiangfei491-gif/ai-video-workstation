import { directorChatCompletion } from "@/app/lib/director/director-chat";
import type { BuildEditInput } from "./types";
import type { ScriptSegment } from "./edit-graph/types";
import { buildScriptMap, buildShotFirstScriptMap } from "./edit-graph/build-script-map";

export { buildScriptMap, buildShotFirstScriptMap };

const SYSTEM = `你是视频脚本对齐助手。将完整脚本拆成句子，并映射到对应镜头 shotIndex（从 0 开始）。

规则：
1. 每个镜头有 narration 旁白，优先将脚本句子对齐到最匹配的 shotIndex
2. 无法确定的句子 shotIndex 设为 null
3. 不要改写原文

只返回 JSON：
{
  "segments": [
    { "text": "句子", "shotIndex": 0, "confidence": 0.9 }
  ]
}`;

type AiAlignResponse = {
  segments?: { text: string; shotIndex: number | null; confidence?: number }[];
};

/** GPT 将全文脚本对齐到分镜 */
export async function alignScriptWithAi(input: BuildEditInput): Promise<ScriptSegment[]> {
  const script = (input.script ?? "").trim();
  if (!script) return buildShotFirstScriptMap(input);

  const payload = {
    script: script.slice(0, 8000),
    storyboard: input.storyboard.map((sb) => ({
      shotIndex: sb.shotIndex,
      narration: sb.narration,
      action: sb.action,
    })),
  };

  try {
    const { text } = await directorChatCompletion(
      "edit-plan",
      SYSTEM,
      JSON.stringify(payload, null, 2),
      { json: true, maxTokens: 4000 }
    );
    const parsed = JSON.parse(text) as AiAlignResponse;
    const segs = parsed.segments ?? [];
    if (segs.length === 0) return buildScriptMap(input);

    return segs.map((s, i) => ({
      id: `ai-${i}`,
      text: s.text.trim(),
      shotIndex: s.shotIndex ?? undefined,
      source: "ai" as const,
    }));
  } catch {
    return buildScriptMap(input);
  }
}
