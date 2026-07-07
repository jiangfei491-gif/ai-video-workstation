import { directorChatCompletion } from "./director-chat";
import { emptyTokenLine, mergeTokenLine } from "@/app/lib/cost-ledger/merge";
import type { TokenCostLine } from "@/app/lib/cost-ledger/types";
import type { DirectorProviderPrompt, DirectorStoryboardShot } from "./types";
import { getCharacter } from "@/app/lib/asset-library/character-store";
import { getScene } from "@/app/lib/asset-library/scene-store";
import { getProp } from "@/app/lib/asset-library/prop-store";

type PromptContext = {
  characterIds?: string[];
  sceneIds?: string[];
  propIds?: string[];
  projectBible?: {
    videoType?: string;
    colorTone?: string;
    cameraLanguage?: string;
    lightingRules?: string;
    forbidden?: string;
  };
  projectStyle?: string;
};

function buildResourceContext(ctx?: PromptContext): string {
  if (!ctx) return "";
  const lines: string[] = [];
  if (ctx.projectBible) {
    const b = ctx.projectBible;
    lines.push("项目圣经（全局锁定，不要在每镜重复重写）：");
    if (b.videoType) lines.push(`- 视频类型: ${b.videoType}`);
    if (b.colorTone) lines.push(`- 色调: ${b.colorTone}`);
    if (b.cameraLanguage) lines.push(`- 摄影语言: ${b.cameraLanguage}`);
    if (b.lightingRules) lines.push(`- 光线: ${b.lightingRules}`);
    if (b.forbidden) lines.push(`- 禁止: ${b.forbidden}`);
  }
  if (ctx.projectStyle?.trim()) lines.push(`- 风格 DNA: ${ctx.projectStyle.trim()}`);
  for (const id of ctx.characterIds ?? []) {
    const c = getCharacter(id);
    if (c) lines.push(`- 角色锁定: @${c.name}（外观已建档，Prompt 里只写 @${c.name}，不要重写为"a woman"）`);
  }
  for (const id of ctx.sceneIds ?? []) {
    const s = getScene(id);
    if (s) lines.push(`- 场景锁定: @${s.name}（环境已建档，只写 @${s.name}）`);
  }
  for (const id of ctx.propIds ?? []) {
    const p = getProp(id);
    if (p) lines.push(`- 道具锁定: @${p.name}（外观已建档，只写 @${p.name}）`);
  }
  return lines.length ? `\n\n${lines.join("\n")}` : "";
}

function buildFallbackVideoPrompt(shot: DirectorStoryboardShot): string {
  return [
    `Scene ${shot.sceneNumber}, ${shot.duration}s.`,
    `Character: ${shot.character}.`,
    `Action: ${shot.action}.`,
    `Environment: ${shot.environment}.`,
    `Camera: ${shot.camera}.`,
    `Cinematic, photorealistic, vertical 9:16, smooth motion.`,
  ].join(" ");
}

function buildFallbackImagePrompt(shot: DirectorStoryboardShot, ctx?: PromptContext): string {
  const charToken =
    ctx?.characterIds?.[0] && getCharacter(ctx.characterIds[0])
      ? `@${getCharacter(ctx.characterIds[0])!.name}`
      : shot.character;
  const sceneToken =
    ctx?.sceneIds?.[0] && getScene(ctx.sceneIds[0])
      ? `@${getScene(ctx.sceneIds[0])!.name}`
      : shot.environment;
  return [
    `Inherit locked project style, character, and scene.`,
    `Characters: ${charToken}. Scene: ${sceneToken}.`,
    `Action change only: ${shot.action}. Camera: ${shot.camera}.`,
    `Do not change face, hair, clothing, or scene identity.`,
  ].join(" ");
}

function normalizePrompt(
  raw: Record<string, unknown>,
  shot: DirectorStoryboardShot,
  outputMode: "image" | "video",
  ctx?: PromptContext
): DirectorProviderPrompt {
  const sceneNumber = Number(raw.sceneNumber) || shot.sceneNumber;
  const fallback =
    outputMode === "image"
      ? buildFallbackImagePrompt(shot, ctx)
      : buildFallbackVideoPrompt(shot);
  const providerPrompt =
    (String(raw.providerPrompt ?? "").trim()) || fallback;

  return { sceneNumber, providerPrompt };
}

const PROMPT_BATCH_SIZE = 20;

function buildPromptSystem(outputMode: "image" | "video"): string {
  return outputMode === "image"
    ? `你是 AI 图像 Prompt 工程师。系统会在生成前自动注入「项目圣经 + 角色锁定 + 场景锁定 + 上一镜继承」。

你的任务：为每个镜头只写「变化量 delta」英文 Prompt，不要重写完整世界设定。

要求：
- 英文，适合 GPT 图像模型
- 角色必须用 @角色名 引用（已建档），禁止写 "a woman" / "young female" 等泛称
- 场景必须用 @场景名 引用，禁止每镜重写完整环境
- 镜头 2 起必须写 "Inherit from previous shot: same character face, outfit, scene, lighting, color grade"
- 只描述本镜变化：动作、机位、构图微调
- 竖屏静态单帧，不要描述视频运动
- 每镜头一条

只返回 JSON：
{
  "prompts": [
    {
      "sceneNumber": 1,
      "providerPrompt": "English delta-only prompt with @Character @Scene..."
    }
  ]
}`
    : `你是 AI 视频 Prompt 工程师。根据导演分镜，为每个镜头生成 Google Veo 原生 text-to-video Prompt。

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
}`;
}

async function generateProviderPromptsBatch(
  title: string,
  storyboard: DirectorStoryboardShot[],
  outputMode: "image" | "video",
  ctx?: PromptContext
): Promise<{ prompts: DirectorProviderPrompt[]; usage: TokenCostLine }> {
  const storyboardJson = JSON.stringify(storyboard, null, 2);
  const resourceBlock = buildResourceContext(ctx);
  const systemPrompt = buildPromptSystem(outputMode);

  const { text, usage } = await directorChatCompletion(
    outputMode === "image" ? "image-prompt" : "video-prompt",
    systemPrompt,
    `标题：${title}${resourceBlock}\n\n导演分镜：\n${storyboardJson}`,
    { json: true, maxTokens: Math.min(16384, 600 + storyboard.length * 220) }
  );

  const parsed = JSON.parse(text) as { prompts?: Record<string, unknown>[] };
  const rawPrompts = parsed.prompts ?? [];
  if (rawPrompts.length === 0) {
    throw new Error(outputMode === "image" ? "未能生成文生图提示词" : "未能生成视频提示词");
  }

  const byScene = new Map<number, DirectorProviderPrompt>();
  for (const raw of rawPrompts) {
    const sceneNumber = Number(raw.sceneNumber);
    const shot = storyboard.find((s) => s.sceneNumber === sceneNumber);
    if (!shot) continue;
    byScene.set(sceneNumber, normalizePrompt(raw, shot, outputMode, ctx));
  }

  return {
    prompts: storyboard.map((shot) => {
      const fallback =
        outputMode === "image"
          ? buildFallbackImagePrompt(shot, ctx)
          : buildFallbackVideoPrompt(shot);
      return (
        byScene.get(shot.sceneNumber) ?? {
          sceneNumber: shot.sceneNumber,
          providerPrompt: fallback,
        }
      );
    }),
    usage,
  };
}

export async function generateProviderPrompts(
  title: string,
  storyboard: DirectorStoryboardShot[],
  outputMode: "image" | "video" = "video",
  ctx?: PromptContext
): Promise<{ prompts: DirectorProviderPrompt[]; usage: TokenCostLine }> {
  if (storyboard.length <= PROMPT_BATCH_SIZE) {
    return generateProviderPromptsBatch(title, storyboard, outputMode, ctx);
  }

  let usage = emptyTokenLine();
  const prompts: DirectorProviderPrompt[] = [];

  for (let i = 0; i < storyboard.length; i += PROMPT_BATCH_SIZE) {
    const batch = storyboard.slice(i, i + PROMPT_BATCH_SIZE);
    const part = await generateProviderPromptsBatch(title, batch, outputMode, ctx);
    prompts.push(...part.prompts);
    usage = mergeTokenLine(usage, part.usage);
  }

  return { prompts, usage };
}
