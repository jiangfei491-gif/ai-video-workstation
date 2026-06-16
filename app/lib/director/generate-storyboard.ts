import { directorChatCompletion } from "./director-chat";
import type { DirectorStoryboardShot } from "./types";

const VALID_TRANSITIONS = ["Cut", "Fade", "Dissolve", "Wipe", "Match Cut"];

function normalizeTransition(val: unknown): string {
  if (typeof val !== "string" || !val.trim()) return "Cut";
  const lower = val.trim().toLowerCase();
  const match = VALID_TRANSITIONS.find((t) => t.toLowerCase() === lower);
  return match ?? val.trim();
}

function normalizeShot(raw: Record<string, unknown>, index: number): DirectorStoryboardShot {
  const sceneNumber = Number(raw.sceneNumber) || index + 1;
  const duration = Math.max(3, Math.min(15, Number(raw.duration) || 5));

  return {
    sceneNumber,
    duration,
    character: (String(raw.character ?? "").trim()) || "未指定角色",
    action: (String(raw.action ?? "").trim()) || "未指定动作",
    environment: (String(raw.environment ?? "").trim()) || "未指定环境",
    camera: (String(raw.camera ?? "").trim()) || "中景固定镜头",
    transition: normalizeTransition(raw.transition),
    narration: String(raw.narration ?? "").trim(),
  };
}

export async function generateStoryboard(
  title: string,
  script: string,
  shotCount = 5
): Promise<DirectorStoryboardShot[]> {
  const { text } = await directorChatCompletion(
    "director-storyboard",
    `你是 AI 原生视频导演。根据标题和脚本输出 ${shotCount} 个镜头的导演分镜。
每个镜头用于后续 Veo 文本生成视频（非图片转视频）。

每个镜头必须包含：
- sceneNumber：镜头序号（从 1 开始）
- duration：时长（秒，3-15）
- character：角色描述
- action：动作描述
- environment：环境/场景
- camera：镜头语言（如广角跟拍、特写、俯拍等）
- transition：转场（Cut / Fade / Dissolve / Wipe / Match Cut）
- narration：该镜头旁白（中文）

只返回 JSON：
{
  "storyboard": [
    {
      "sceneNumber": 1,
      "duration": 5,
      "character": "年轻女孩",
      "action": "推开咖啡馆门进入",
      "environment": "现代咖啡馆",
      "camera": "广角跟拍",
      "transition": "Cut",
      "narration": "旁白文本"
    }
  ]
}

storyboard 数组长度必须恰好等于 ${shotCount}。`,
    `标题：${title}\n\n脚本：\n${script}`,
    { json: true, maxTokens: 4500 }
  );

  const parsed = JSON.parse(text) as { storyboard?: Record<string, unknown>[] };
  const rawShots = parsed.storyboard ?? [];
  if (rawShots.length === 0) throw new Error("未能生成导演分镜");

  const shots = rawShots
    .slice(0, shotCount)
    .map((raw, i) => normalizeShot(raw, i));

  while (shots.length < shotCount) {
    const last = shots[shots.length - 1];
    shots.push({
      ...last,
      sceneNumber: shots.length + 1,
      narration: last?.narration ?? "",
    });
  }

  return shots.map((s, i) => ({ ...s, sceneNumber: i + 1 }));
}
