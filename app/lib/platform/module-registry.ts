/**
 * AI Cut 各模块对照表 — 单一事实来源
 *
 * 总负责人：AI 导演 GPT-4.1（决策层，下发各中心任务）
 * 执行层模块按表中 ai负责人 / 引擎 分工，不越权决策。
 */

export type ModuleId =
  | "ai-director"
  | "material-center"
  | "video-creation-script"
  | "video-creation-media"
  | "voice-center"
  | "subtitle-center"
  | "music-center"
  | "effect-center"
  | "qa-center"
  | "clip-agent"
  | "opencut";

export type AiLeadId =
  | "gpt-4.1"
  | "claude"
  | "deepseek"
  | "clip-agent"
  | "none";

export type PlatformModule = {
  id: ModuleId;
  /** 模块名称 */
  title: string;
  /** 总负责人 */
  overallLead: string;
  /** AI 负责人（none = 无 AI，纯执行） */
  aiLead: AiLeadId;
  aiLeadLabel: string;
  /** 实际使用的 AI / 引擎 */
  engines: string;
  /** 职责 */
  responsibilities: string;
  implementation: string[];
};

export const DIRECTOR_OVERALL_LEAD = "AI 导演 GPT-4.1";

/** 与产品对照表一致 */
export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: "ai-director",
    title: "AI 导演",
    overallLead: DIRECTOR_OVERALL_LEAD,
    aiLead: "gpt-4.1",
    aiLeadLabel: "GPT-4.1",
    engines: "OpenAI GPT-4.1（directorChatCompletion）",
    responsibilities:
      "全局决策：素材、镜长、转场、节奏、配音字幕策略 → 输出 Director Plan",
    implementation: ["app/lib/director-plan", "app/lib/director/director-chat"],
  },
  {
    id: "material-center",
    title: "内容中心",
    overallLead: DIRECTOR_OVERALL_LEAD,
    aiLead: "claude",
    aiLeadLabel: "Claude",
    engines: "GPT-4.1（找素材）· GPT / Claude / Gemini / DeepSeek（脚本进化）",
    responsibilities: "找料、写脚本、改写、评分",
    implementation: ["app/components/materials", "app/lib/materials"],
  },
  {
    id: "video-creation-script",
    title: "创作中心（编导 / 分镜 / 口播稿）",
    overallLead: DIRECTOR_OVERALL_LEAD,
    aiLead: "gpt-4.1",
    aiLeadLabel: "GPT-4.1",
    engines: "OpenAI GPT-4.1（轻任务 mini）",
    responsibilities: "写脚本、分镜、口播稿、视觉设定",
    implementation: [
      "app/lib/director/run-director-pipeline",
      "app/components/workflows/t2v/T2VWorkbench",
    ],
  },
  {
    id: "video-creation-media",
    title: "创作中心（画面生成 / 图片）",
    overallLead: DIRECTOR_OVERALL_LEAD,
    aiLead: "gpt-4.1",
    aiLeadLabel: "GPT-4.1",
    engines: "多模型：FLUX · GPT Image 2 · Google Veo 3.1 · GPT-4o-mini（QC）",
    responsibilities: "首帧生成、文生图、图生视频",
    implementation: [
      "app/lib/consistency-engine",
      "app/lib/image",
      "app/lib/veo",
      "app/api/director/shot-frame",
      "app/api/veo/generate",
    ],
  },
  {
    id: "voice-center",
    title: "配音中心",
    overallLead: DIRECTOR_OVERALL_LEAD,
    aiLead: "none",
    aiLeadLabel: "—（纯执行）",
    engines: "F5 · Fish Speech · CosyVoice · Edge · ElevenLabs · OpenAI TTS",
    responsibilities: "选引擎、合成、返回音频与时间轴（不参与决策）",
    implementation: ["app/lib/voice-center", "app/api/voice-center"],
  },
  {
    id: "subtitle-center",
    title: "字幕中心",
    overallLead: DIRECTOR_OVERALL_LEAD,
    aiLead: "deepseek",
    aiLeadLabel: "DeepSeek（智能优化）· 导演编排其余",
    engines:
      "DeepSeek（断句/润色/高亮）· Rule Engine · Whisper · GPT-4.1（翻译）",
    responsibilities: "生成/优化字幕，导出 SRT/ASS，交付 OpenCut",
    implementation: ["app/lib/subtitle-center", "app/api/subtitle-center"],
  },
  {
    id: "music-center",
    title: "音乐中心",
    overallLead: DIRECTOR_OVERALL_LEAD,
    aiLead: "deepseek",
    aiLeadLabel: "DeepSeek Music Agent",
    engines: "DeepSeek（推荐）· Rule Engine · FFmpeg 音频滤镜",
    responsibilities:
      "BGM/音效管理、Ducking、Fade、卡点、音乐时间轴，交付 OpenCut",
    implementation: ["app/lib/music-center", "app/api/music-center"],
  },
  {
    id: "effect-center",
    title: "特效中心",
    overallLead: DIRECTOR_OVERALL_LEAD,
    aiLead: "deepseek",
    aiLeadLabel: "DeepSeek Effect Agent",
    engines: "DeepSeek（分析）· Rule Engine · FFmpeg 视频滤镜",
    responsibilities:
      "转场、镜头动画、缩放/Blur/Flash/Shake/Motion/Glow，生成时间轴交付 OpenCut",
    implementation: ["app/lib/effect-center", "app/api/effect-center"],
  },
  {
    id: "clip-agent",
    title: "剪辑 Agent",
    overallLead: "—",
    aiLead: "none",
    aiLeadLabel: "—（纯规则）",
    engines: "纯规则代码",
    responsibilities: "Director Plan → OpenCut 命令",
    implementation: ["app/lib/clip-agent"],
  },
  {
    id: "opencut",
    title: "OpenCut",
    overallLead: "—",
    aiLead: "clip-agent",
    aiLeadLabel: "剪辑 Agent",
    engines: "本地 NLE + FFmpeg",
    responsibilities: "时间线、特效、字幕渲染、导出 MP4（不思考）",
    implementation: [
      "app/lib/opencut",
      "app/components/workflows/ai-edit/OpenCutEditorEmbed",
    ],
  },
  {
    id: "qa-center",
    title: "质检中心",
    overallLead: "—",
    aiLead: "deepseek",
    aiLeadLabel: "DeepSeek QA Agent",
    engines: "Rule Engine · FFmpeg · blackdetect · DeepSeek 评分",
    responsibilities: "成片质检、Quality Score、报告、环节定点自动修复（用户拍板）",
    implementation: ["app/lib/qa-center", "app/api/qa-center"],
  },
];

export function getPlatformModule(id: ModuleId): PlatformModule | undefined {
  return PLATFORM_MODULES.find((m) => m.id === id);
}

/** 内容中心默认 AI 负责人：Claude 优先 */
export function materialCenterPreferredProvider(): "claude" | "gpt" | "gemini" | "deepseek" {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "claude";
  if (process.env.OPENAI_API_KEY?.trim()) return "gpt";
  if (process.env.VEO_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()) return "gemini";
  if (process.env.DEEPSEEK_API_KEY?.trim()) return "deepseek";
  return "claude";
}
