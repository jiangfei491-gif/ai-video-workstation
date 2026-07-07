/**
 * Legacy Registry 静态数据（与 seeders/001_registry.sql 对齐）
 * Legacy 模式不查 PostgreSQL。
 */

export const LEGACY_AGENTS = [
  { slug: "ai-director-agent", display_name: "AI 导演 Agent", kind: "decision" },
  { slug: "director-script-agent", display_name: "编导脚本 Agent", kind: "decision" },
  { slug: "director-storyboard-agent", display_name: "分镜 Agent", kind: "decision" },
  { slug: "director-prompt-agent", display_name: "Prompt Agent", kind: "decision" },
  { slug: "director-plan-agent", display_name: "Director Plan Agent", kind: "decision" },
  { slug: "clip-agent", display_name: "剪辑 Agent", kind: "execute" },
  { slug: "subtitle-agent", display_name: "字幕 Agent", kind: "orchestrate" },
  { slug: "music-agent", display_name: "音乐 Agent", kind: "orchestrate" },
  { slug: "effect-agent", display_name: "特效 Agent", kind: "orchestrate" },
  { slug: "qa-agent", display_name: "质检 Agent", kind: "orchestrate" },
  { slug: "material-agent", display_name: "素材 Agent", kind: "orchestrate" },
  { slug: "script-evolution-agent", display_name: "脚本进化 Agent", kind: "decision" },
  { slug: "consistency-agent", display_name: "一致性 Agent", kind: "decision" },
  { slug: "ai-director-orchestrator", display_name: "AI 导演编排器", kind: "orchestrate" },
] as const;

export const LEGACY_CENTERS = [
  { slug: "material-center", display_name: "素材中心", route: "/materials" },
  { slug: "video-creation-center", display_name: "创作中心", route: "/ai-video" },
  { slug: "ai-director-center", display_name: "AI 导演中心", route: "/ai-director" },
  { slug: "voice-center", display_name: "配音中心", route: "/voice-center" },
  { slug: "subtitle-center", display_name: "字幕中心", route: "/subtitle-center" },
  { slug: "music-center", display_name: "音乐中心", route: "/music-center" },
  { slug: "effect-center", display_name: "特效中心", route: "/effect-center" },
  { slug: "edit-center", display_name: "剪辑中心", route: "/ai-edit" },
  { slug: "qa-center", display_name: "质检中心", route: "/qa-center" },
  { slug: "model-center", display_name: "模型中心", route: null },
  { slug: "resource-center", display_name: "资源中心", route: "/resources" },
  { slug: "trends-center", display_name: "热点中心", route: "/trends" },
] as const;

export const LEGACY_PROVIDERS = [
  { slug: "openai", display_name: "OpenAI", kind: "llm" },
  { slug: "anthropic", display_name: "Anthropic", kind: "llm" },
  { slug: "google", display_name: "Google", kind: "llm" },
  { slug: "deepseek", display_name: "DeepSeek", kind: "llm" },
  { slug: "bfl", display_name: "Black Forest Labs", kind: "image" },
  { slug: "fal", display_name: "FAL", kind: "image" },
  { slug: "veo", display_name: "Google Veo", kind: "video" },
  { slug: "edge-tts", display_name: "Edge TTS", kind: "tts" },
  { slug: "openai-audio", display_name: "OpenAI Audio", kind: "tts" },
  { slug: "elevenlabs", display_name: "ElevenLabs", kind: "tts" },
  { slug: "ffmpeg", display_name: "FFmpeg", kind: "render" },
  { slug: "opencut", display_name: "OpenCut", kind: "nle" },
] as const;

export const LEGACY_MODELS = [
  { provider_slug: "openai", model_key: "gpt-4.1", display_name: "GPT-4.1", modality: "llm" },
  { provider_slug: "openai", model_key: "gpt-4o", display_name: "GPT-4o", modality: "llm" },
  { provider_slug: "openai", model_key: "gpt-4o-mini", display_name: "GPT-4o Mini", modality: "llm" },
  { provider_slug: "deepseek", model_key: "deepseek-chat", display_name: "DeepSeek Chat", modality: "llm" },
  { provider_slug: "veo", model_key: "veo-2", display_name: "Veo 2", modality: "video" },
] as const;

export const LEGACY_WORKFLOWS = [
  { slug: "t2v-pipeline", display_name: "T2V 创作中心流水线" },
  { slug: "ai-cut-pipeline", display_name: "AI Cut 自动剪辑流水线" },
  { slug: "ai-director-orchestrator", display_name: "AI 导演一键编排" },
] as const;

export const LEGACY_JOB_TYPES = [
  { slug: "render_ffmpeg", display_name: "FFmpeg 渲染", category: "render" },
  { slug: "auto_edit_pipeline", display_name: "自动剪辑流水线", category: "edit" },
  { slug: "video_generate", display_name: "视频生成", category: "media" },
] as const;

export const LEGACY_ARTIFACT_KINDS = [
  { slug: "director_plan", display_name: "Director Plan" },
  { slug: "edit_graph", display_name: "EditGraph" },
] as const;

export const LEGACY_RESOURCE_TYPES = [
  { slug: "character", display_name: "角色" },
  { slug: "scene", display_name: "场景" },
  { slug: "prop", display_name: "道具" },
] as const;

export const LEGACY_TEMPLATE_KINDS = [
  { slug: "subtitle_style", display_name: "字幕样式" },
  { slug: "music_style", display_name: "音乐风格" },
] as const;

export const DEFAULT_DEV_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "dev@local.ai-cut",
  display_name: "Dev User",
};

export const DEFAULT_DEV_WORKSPACE = {
  id: "00000000-0000-4000-8000-000000000010",
  slug: "default",
  display_name: "Default Workspace",
};
