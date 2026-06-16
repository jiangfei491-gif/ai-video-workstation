import { directorChatCompletion } from "./director-chat";
import type { DirectorProviderPrompt, DirectorStoryboardShot } from "./types";

function buildFallbackPrompt(shot: DirectorStoryboardShot): string {
  return [
    `Scene ${shot.sceneNumber}, ${shot.duration}s.`,
    `Character: ${shot.character}.`,
    `Action: ${shot.action}.`,
    `Environment: ${shot.environment}.`,
    `Camera: ${shot.camera}.`,
    `Cinematic, photorealistic, vertical 9:16, smooth motion.`,
  ].join(" ");
}

function normalizePrompt(
  raw: Record<string, unknown>,
  shot: DirectorStoryboardShot
): DirectorProviderPrompt {
  const sceneNumber = Number(raw.sceneNumber) || shot.sceneNumber;
  const providerPrompt =
    (String(raw.providerPrompt ?? "").trim()) || buildFallbackPrompt(shot);

  return { sceneNumber, providerPrompt };
}

export async function generateProviderPrompts(
  title: string,
  storyboard: DirectorStoryboardShot[]
): Promise<DirectorProviderPrompt[]> {
  const storyboardJson = JSON.stringify(storyboard, null, 2);

  const { text } = await directorChatCompletion(
    "video-prompt",
    `你是 AI 视频 Prompt 工程师。根据导演分镜，为每个镜头生成 Google Veo 原生 text-to-video Prompt。

要求：
- 英文 Prompt，适合 Veo text-to-video 模型
- 包含角色、动作、环境、镜头运动、光线、风格
- 竖屏 9:16，电影感，动作连贯
- 每镜头一条，时长与分镜一致
- 不要提及 image-to-video 或 static image

只返回 JSON：
{
  "prompts": [
    {
      "sceneNumber": 1,
      "providerPrompt": "English text-to-video prompt..."
    }
  ]
}`,
    `标题：${title}\n\n导演分镜：\n${storyboardJson}`,
    { json: true, maxTokens: 4500 }
  );

  const parsed = JSON.parse(text) as { prompts?: Record<string, unknown>[] };
  const rawPrompts = parsed.prompts ?? [];
  if (rawPrompts.length === 0) throw new Error("未能生成视频提示词");

  const byScene = new Map<number, DirectorProviderPrompt>();
  for (const raw of rawPrompts) {
    const sceneNumber = Number(raw.sceneNumber);
    const shot = storyboard.find((s) => s.sceneNumber === sceneNumber);
    if (!shot) continue;
    byScene.set(sceneNumber, normalizePrompt(raw, shot));
  }

  return storyboard.map((shot) => {
    return (
      byScene.get(shot.sceneNumber) ?? {
        sceneNumber: shot.sceneNumber,
        providerPrompt: buildFallbackPrompt(shot),
      }
    );
  });
}
