import type { ShotMemory } from "../types/shot";

/** 从上一镜分镜数据构建 Shot Memory（纯函数，客户端/服务端均可） */
export function buildShotMemory(params: {
  inheritFrom: number | null;
  shotIndex: number;
  storyboard: { character: string; action: string; environment: string; camera: string }[];
  prompts: { providerPrompt?: string }[];
  characterIds: string[];
  sceneId?: string;
  propIds: string[];
  /** 客户端必须传入 @token；服务端 compose 前由 Bible 模块解析 */
  characterTokensOverride?: string[];
  sceneTokenOverride?: string | null;
  propTokensOverride?: string[];
}): ShotMemory | undefined {
  if (params.inheritFrom == null || params.inheritFrom < 0) return undefined;

  const idx = params.inheritFrom;
  const sb = params.storyboard[idx];
  const prompt = params.prompts[idx]?.providerPrompt ?? "";

  const chars = params.characterTokensOverride?.join(", ") ?? "";
  const scene =
    params.sceneTokenOverride ?? (sb?.environment ? sb.environment : "");
  const props = params.propTokensOverride?.join(", ") ?? "";

  const bits = [
    chars ? `Characters: ${chars}` : sb?.character ? `Character: ${sb.character}` : "",
    scene ? `Scene: ${scene}` : "",
    props ? `Props: ${props}` : "",
    sb?.action ? `Action: ${sb.action}` : "",
    sb?.camera ? `Camera: ${sb.camera}` : "",
    prompt ? `Prompt excerpt: ${prompt.slice(0, 200)}` : "",
  ].filter(Boolean);

  return {
    inheritFrom: params.inheritFrom,
    summary: bits.join(". "),
    locked: {
      characterIds: params.characterIds,
      sceneId: params.sceneId,
      propIds: params.propIds,
    },
  };
}

/** @deprecated 兼容 V1 */
export function buildPreviousShotSummary(params: {
  shotIndex: number;
  storyboard: { character: string; action: string; environment: string; camera: string }[];
  prompts: { providerPrompt?: string }[];
  characterTokens?: string[];
  sceneToken?: string | null;
}): string {
  const memory = buildShotMemory({
    inheritFrom: params.shotIndex,
    shotIndex: params.shotIndex + 1,
    storyboard: params.storyboard,
    prompts: params.prompts,
    characterIds: [],
    characterTokensOverride: params.characterTokens,
    sceneTokenOverride: params.sceneToken,
    propIds: [],
  });
  return memory?.summary ?? "";
}
