import { directorChatCompletion } from "@/app/lib/director/director-chat";
import type { BuildEditInput } from "./types";
import type { StoryboardShot } from "@/app/lib/workbench-persist/types";
import { buildShotNarrationMap } from "./audio/align-voice-subtitle";

const SYSTEM = `你是短视频口播编剧。根据「完整脚本」和「分镜列表」，为每个镜头写口播稿。

要求：
1. 直接对观众说话，口语化、短句，适合朗读和上字幕
2. 禁止写镜头/画面/动作描述（不要「镜头推进」「她走进房间」这类）
3. 忠实脚本事实，不捏造人物或情节
4. 每镜 1–3 句，每镜 total 15–90 个汉字为宜
5. shotIndex 从 0 开始，与输入一致

只返回 JSON：
{
  "shots": [
    { "shotIndex": 0, "narration": "口播短句" }
  ]
}`;

type AiSpokenResponse = {
  shots?: { shotIndex: number; narration: string }[];
};

/** GPT：脚本 + 分镜 → 每镜口语化口播稿 */
export async function generateSpokenNarrationWithAi(
  input: BuildEditInput
): Promise<Map<number, string>> {
  const script = (input.script ?? "").trim();
  if (!input.storyboard.length) {
    return buildShotNarrationMap(input);
  }

  const payload = {
    script: script.slice(0, 12000),
    storyboard: input.storyboard.map((sb) => ({
      shotIndex: sb.shotIndex,
      durationSec: sb.duration,
      action: sb.action,
      environment: sb.environment,
      existingNarration: sb.narration,
    })),
  };

  try {
    const { text } = await directorChatCompletion(
      "edit-plan",
      SYSTEM,
      JSON.stringify(payload, null, 2),
      { json: true, maxTokens: 4000 }
    );
    const parsed = JSON.parse(text) as AiSpokenResponse;
    const map = new Map<number, string>();

    for (const row of parsed.shots ?? []) {
      const narr = row.narration?.trim();
      if (narr && Number.isFinite(row.shotIndex)) {
        map.set(row.shotIndex, narr);
      }
    }

    if (map.size === 0) return buildShotNarrationMap(input);
    return map;
  } catch {
    return buildShotNarrationMap(input);
  }
}

export function applySpokenNarrationsToStoryboard(
  storyboard: StoryboardShot[],
  narrations: Map<number, string>
): StoryboardShot[] {
  return storyboard.map((sb) => {
    const idx = sb.sceneNumber - 1;
    const narr = narrations.get(idx);
    if (!narr?.trim()) return sb;
    return { ...sb, narration: narr.trim() };
  });
}
