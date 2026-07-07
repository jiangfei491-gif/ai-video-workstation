/**
 * 平台分层架构 — 与 module-registry 对照表对齐
 */

import type { ModuleId } from "./module-registry";

export type PipelineOwner =
  | "director"
  | "clip-agent"
  | "opencut"
  | "ai-agent"
  | "ffmpeg";

export type PipelineStageId =
  | "material-center"
  | "ai-find-materials"
  | "ai-script"
  | "ai-storyboard"
  | "ai-media-gen"
  | "director-plan"
  | "clip-agent"
  | "opencut-nle"
  | "ai-tts"
  | "ai-subtitles"
  | "ai-music"
  | "ai-effects"
  | "qa-center"
  | "export";

export const V2_DEFAULT_EDIT_ROUTE = "/ai-edit";
export const V2_ADVANCED_EDIT_ROUTE = "/ai-edit/advanced";

export type PipelineStage = {
  id: PipelineStageId;
  order: number;
  title: string;
  shortLabel: string;
  owner: PipelineOwner;
  /** 对照表模块 id */
  moduleId: ModuleId;
  description: string;
  implementation: string[];
};

export const PLATFORM_PIPELINE: PipelineStage[] = [
  {
    id: "material-center",
    order: 1,
    title: "内容中心",
    shortLabel: "素材",
    owner: "ai-agent",
    moduleId: "material-center",
    description: "Claude 负责脚本进化 · GPT-4.1 找素材 · 改写评分",
    implementation: ["app/components/materials", "app/lib/materials"],
  },
  {
    id: "ai-find-materials",
    order: 2,
    title: "AI 找素材",
    shortLabel: "找料",
    owner: "ai-agent",
    moduleId: "material-center",
    description: "GPT-4.1 检索互联网素材",
    implementation: ["app/lib/materials/agent", "app/lib/materials/material-search-providers"],
  },
  {
    id: "ai-script",
    order: 3,
    title: "编导 / 口播稿",
    shortLabel: "脚本",
    owner: "director",
    moduleId: "video-creation-script",
    description: "GPT-4.1 写脚本与口播稿",
    implementation: ["app/lib/director/generate-script", "app/lib/auto-edit/generate-spoken-narration"],
  },
  {
    id: "ai-storyboard",
    order: 4,
    title: "AI 分镜",
    shortLabel: "分镜",
    owner: "director",
    moduleId: "video-creation-script",
    description: "GPT-4.1 导演分镜与视觉设定",
    implementation: ["app/lib/director/generate-storyboard", "app/lib/director/infer-visual-settings"],
  },
  {
    id: "ai-media-gen",
    order: 5,
    title: "画面 / 视频生成",
    shortLabel: "画面",
    owner: "ai-agent",
    moduleId: "video-creation-media",
    description: "多模型：FLUX · GPT Image · Veo 3.1",
    implementation: ["app/lib/consistency-engine", "app/lib/image", "app/lib/veo"],
  },
  {
    id: "director-plan",
    order: 6,
    title: "AI 导演方案",
    shortLabel: "导演",
    owner: "director",
    moduleId: "ai-director",
    description: "GPT-4.1 全局决策 → Director Plan",
    implementation: ["app/lib/director-plan"],
  },
  {
    id: "ai-tts",
    order: 7,
    title: "配音中心",
    shortLabel: "配音",
    owner: "ai-agent",
    moduleId: "voice-center",
    description: "纯执行 TTS · 无 AI 决策",
    implementation: ["app/lib/voice-center", "app/api/voice-center"],
  },
  {
    id: "ai-subtitles",
    order: 8,
    title: "字幕中心",
    shortLabel: "字幕",
    owner: "ai-agent",
    moduleId: "subtitle-center",
    description: "DeepSeek 优化 · Rule Engine 导出 · 导演编排翻译/打轴",
    implementation: ["app/lib/subtitle-center", "app/api/subtitle-center"],
  },
  {
    id: "ai-music",
    order: 9,
    title: "音乐中心",
    shortLabel: "音乐",
    owner: "ai-agent",
    moduleId: "music-center",
    description: "DeepSeek 推荐 BGM · Rule Engine 时间轴 · Ducking · 卡点",
    implementation: ["app/lib/music-center", "app/api/music-center"],
  },
  {
    id: "ai-effects",
    order: 10,
    title: "特效中心",
    shortLabel: "特效",
    owner: "ai-agent",
    moduleId: "effect-center",
    description: "DeepSeek 分析转场/镜头特效 · Rule Engine 时间轴",
    implementation: ["app/lib/effect-center", "app/api/effect-center"],
  },
  {
    id: "clip-agent",
    order: 11,
    title: "剪辑 Agent",
    shortLabel: "剪辑Agent",
    owner: "clip-agent",
    moduleId: "clip-agent",
    description: "纯规则：Director Plan → OpenCut 命令",
    implementation: ["app/lib/clip-agent"],
  },
  {
    id: "opencut-nle",
    order: 12,
    title: "OpenCut",
    shortLabel: "OpenCut",
    owner: "opencut",
    moduleId: "opencut",
    description: "剪辑 Agent 驱动 · 本地 NLE 执行",
    implementation: [
      "app/lib/opencut/client",
      "app/lib/opencut/commands",
      "app/components/workflows/ai-edit/OpenCutEditorEmbed",
    ],
  },
  {
    id: "export",
    order: 13,
    title: "导出 MP4",
    shortLabel: "导出",
    owner: "opencut",
    moduleId: "opencut",
    description: "OpenCut 导出成片",
    implementation: ["app/lib/opencut/client"],
  },
  {
    id: "qa-center",
    order: 14,
    title: "质检中心",
    shortLabel: "质检",
    owner: "ai-agent",
    moduleId: "qa-center",
    description: "Rule Engine + DeepSeek 评分 · 低于阈值回流导演",
    implementation: ["app/lib/qa-center", "app/api/qa-center"],
  },
];

export const OPENCUT_ENGINE_RESPONSIBILITIES = [
  "管理时间轴（Timeline）",
  "管理媒体和轨道（Media & Tracks）",
  "渲染特效、动画、转场",
  "字幕轨道渲染",
  "导出视频",
] as const;

export const OPENCUT_CAPABILITIES = [
  "时间线",
  "多轨编辑",
  "视频裁剪",
  "转场",
  "音频轨道",
  "字幕轨道",
  "导出 MP4",
] as const;

export const DIRECTOR_RESPONSIBILITIES = [
  "用哪个素材",
  "放几秒",
  "什么转场",
  "配什么字幕",
  "配什么配音",
  "什么节奏",
] as const;

export const AI_AGENT_CAPABILITIES = [
  "内容中心：Claude 主导脚本进化",
  "创作中心：GPT-4.1 编导分镜 + 多模型画面",
  "配音中心：TTS 引擎纯执行",
  "字幕中心：DeepSeek 优化 + 导演编排 Whisper/翻译",
  "音乐中心：DeepSeek 推荐 + Rule Engine 音乐时间轴",
  "特效中心：DeepSeek 分析 + Rule Engine 转场/镜头特效",
  "质检中心：Rule Engine + DeepSeek 评分 · 可回流导演",
] as const;

export const OWNER_LABEL: Record<PipelineOwner, string> = {
  director: "AI 导演 GPT-4.1",
  "clip-agent": "剪辑 Agent",
  opencut: "OpenCut（剪辑 Agent 驱动）",
  "ai-agent": "执行 Agent",
  ffmpeg: "FFmpeg（fallback）",
};

export const AI_CUT_PIPELINE_SUMMARY = `
AI 导演 GPT-4.1 → Director Plan → 配音/字幕/音乐/特效中心 → 剪辑 Agent → OpenCut → 质检中心 → MP4
`.trim();

export const ONE_CLICK_PIPELINE_SUMMARY = AI_CUT_PIPELINE_SUMMARY;

export function pipelineStagesByOwner(owner: PipelineOwner): PipelineStage[] {
  return PLATFORM_PIPELINE.filter((s) => s.owner === owner);
}

export function pipelineStage(id: PipelineStageId): PipelineStage | undefined {
  return PLATFORM_PIPELINE.find((s) => s.id === id);
}
