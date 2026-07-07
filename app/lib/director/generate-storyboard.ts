import { directorChatCompletion } from "./director-chat";
import { emptyTokenLine, mergeTokenLine } from "@/app/lib/cost-ledger/merge";
import type { TokenCostLine } from "@/app/lib/cost-ledger/types";
import type { DirectorStoryboardShot } from "./types";

const VALID_TRANSITIONS = ["Cut", "Fade", "Dissolve", "Wipe", "Match Cut"];
const STORYBOARD_BATCH_SIZE = 24;

export type GenerateStoryboardOptions = {
  shotDurationSec?: number;
  outputMode?: "image" | "video";
};

function normalizeTransition(val: unknown): string {
  if (typeof val !== "string" || !val.trim()) return "Cut";
  const lower = val.trim().toLowerCase();
  const match = VALID_TRANSITIONS.find((t) => t.toLowerCase() === lower);
  return match ?? val.trim();
}

function durationBounds(outputMode: "image" | "video", defaultDuration: number) {
  if (outputMode === "image") {
    return { min: 1, max: 86400, default: defaultDuration };
  }
  return { min: 3, max: 15, default: defaultDuration };
}

function normalizeShot(
  raw: Record<string, unknown>,
  index: number,
  bounds: ReturnType<typeof durationBounds>
): DirectorStoryboardShot {
  const sceneNumber = Number(raw.sceneNumber) || index + 1;
  const duration = Math.max(
    bounds.min,
    Math.min(bounds.max, Number(raw.duration) || bounds.default)
  );

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

function sliceScriptForBatch(script: string, batchIndex: number, batchCount: number): string {
  const text = script.trim();
  if (!text || batchCount <= 1) return text;
  const start = Math.floor((batchIndex / batchCount) * text.length);
  const end = Math.floor(((batchIndex + 1) / batchCount) * text.length);
  const slice = text.slice(start, end).trim();
  return slice || text;
}

function storyboardSystemPrompt(
  shotCount: number,
  outputMode: "image" | "video",
  defaultDuration: number
): string {
  const medium =
    outputMode === "image"
      ? "文生图分镜（Ken Burns 静帧，每镜停留时长由 duration 控制）"
      : "Veo 文本生成视频（非图片转视频）";

  return `你是 AI 原生视频导演。根据标题和脚本输出 ${shotCount} 个镜头的导演分镜。
每个镜头用于后续 ${medium}。

每个镜头必须包含：
- sceneNumber：镜头序号（从指定起始号递增）
- duration：时长（秒，${outputMode === "image" ? "建议统一为 " + defaultDuration : "3-15"}）
- character：角色描述
- action：动作描述
- environment：环境/场景
- camera：镜头语言（如广角跟拍、特写、俯拍等）
- transition：转场（Cut / Fade / Dissolve / Wipe / Match Cut）
- narration：该镜头口播稿（中文，1–2 句口语短句，直接对观众说话，不要写画面动作描述；要可朗读、可上字幕）

只返回 JSON：
{
  "storyboard": [
    {
      "sceneNumber": 1,
      "duration": ${defaultDuration},
      "character": "年轻女孩",
      "action": "推开咖啡馆门进入",
      "environment": "现代咖啡馆",
      "camera": "广角跟拍",
      "transition": "Cut",
      "narration": "口播短句，口语化"
    }
  ]
}

storyboard 数组长度必须恰好等于 ${shotCount}。`;
}

async function generateStoryboardBatch(params: {
  title: string;
  script: string;
  shotCount: number;
  startSceneNumber: number;
  outputMode: "image" | "video";
  defaultDuration: number;
  previousShots?: DirectorStoryboardShot[];
}): Promise<{ storyboard: DirectorStoryboardShot[]; usage: TokenCostLine }> {
  const bounds = durationBounds(params.outputMode, params.defaultDuration);
  const prevBlock =
    params.previousShots?.length ?
      `\n\n已生成的前序镜头（保持叙事连贯）：\n${JSON.stringify(params.previousShots.slice(-3), null, 2)}`
    : "";

  const { text, usage } = await directorChatCompletion(
    "director-storyboard",
    storyboardSystemPrompt(params.shotCount, params.outputMode, params.defaultDuration),
    `标题：${params.title}\n起始镜头序号：${params.startSceneNumber}\n\n本批脚本段落：\n${params.script}${prevBlock}`,
    { json: true, maxTokens: Math.min(16384, 800 + params.shotCount * 280) }
  );

  const parsed = JSON.parse(text) as { storyboard?: Record<string, unknown>[] };
  const rawShots = parsed.storyboard ?? [];
  if (rawShots.length === 0) throw new Error("未能生成导演分镜");

  const shots = rawShots
    .slice(0, params.shotCount)
    .map((raw, i) =>
      normalizeShot(raw, params.startSceneNumber + i - 1, bounds)
    );

  while (shots.length < params.shotCount) {
    const last = shots[shots.length - 1];
    shots.push({
      ...last,
      sceneNumber: params.startSceneNumber + shots.length,
      narration: last?.narration ?? "",
    });
  }

  return {
    storyboard: shots.map((s, i) => ({
      ...s,
      sceneNumber: params.startSceneNumber + i,
      duration: params.outputMode === "image" ? params.defaultDuration : s.duration,
    })),
    usage,
  };
}

export async function generateStoryboard(
  title: string,
  script: string,
  shotCount = 5,
  options?: GenerateStoryboardOptions
): Promise<{ storyboard: DirectorStoryboardShot[]; usage: TokenCostLine }> {
  const outputMode = options?.outputMode ?? "video";
  const defaultDuration =
    options?.shotDurationSec ?? (outputMode === "image" ? 6 : 5);

  if (shotCount <= STORYBOARD_BATCH_SIZE) {
    return generateStoryboardBatch({
      title,
      script,
      shotCount,
      startSceneNumber: 1,
      outputMode,
      defaultDuration,
    });
  }

  const batches = Math.ceil(shotCount / STORYBOARD_BATCH_SIZE);
  let usage = emptyTokenLine();
  const storyboard: DirectorStoryboardShot[] = [];

  for (let b = 0; b < batches; b++) {
    const startSceneNumber = b * STORYBOARD_BATCH_SIZE + 1;
    const count = Math.min(STORYBOARD_BATCH_SIZE, shotCount - b * STORYBOARD_BATCH_SIZE);
    const part = await generateStoryboardBatch({
      title,
      script: sliceScriptForBatch(script, b, batches),
      shotCount: count,
      startSceneNumber,
      outputMode,
      defaultDuration,
      previousShots: storyboard,
    });
    storyboard.push(...part.storyboard);
    usage = mergeTokenLine(usage, part.usage);
  }

  return {
    storyboard: storyboard.map((s, i) => ({ ...s, sceneNumber: i + 1 })),
    usage,
  };
}
