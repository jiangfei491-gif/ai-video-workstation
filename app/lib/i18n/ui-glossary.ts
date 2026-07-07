/**
 * 平台 UI 中文化 — 术语表（单一事实来源）
 *
 * 规则：
 * - keepEnglish：品牌、API、格式、会进模型的字段名 — 界面不翻译
 * - zhWithEn：中文为主，首次出现或专业面板可括注英文
 * - zhOnly：纯界面文案，统一中文
 *
 * 改此处后按 docs/ui-glossary-zh.md 的优先级批次改组件。
 */

export type GlossaryTier = "keepEnglish" | "zhWithEn" | "zhOnly";

export type UiGlossaryEntry = {
  /** 界面/API 中出现的英文或混排原文 */
  en: string;
  /** 推荐中文展示（keepEnglish 时与 en 相同或为空表示不展示中文替换） */
  zh: string;
  tier: GlossaryTier;
  /** 括注英文（仅 zhWithEn） */
  enNote?: string;
  note?: string;
};

/** 按英文键排序，便于查找 */
export const UI_GLOSSARY: UiGlossaryEntry[] = [
  // ── 产品 / 品牌（保留）──
  { en: "OpenCut", zh: "OpenCut", tier: "keepEnglish", note: "内嵌 NLE 产品名" },
  { en: "OpenAI", zh: "OpenAI", tier: "keepEnglish" },
  { en: "DeepSeek", zh: "DeepSeek", tier: "keepEnglish" },
  { en: "Claude", zh: "Claude", tier: "keepEnglish" },
  { en: "Gemini", zh: "Gemini", tier: "keepEnglish" },
  { en: "ElevenLabs", zh: "ElevenLabs", tier: "keepEnglish" },
  { en: "Edge TTS", zh: "Edge TTS", tier: "keepEnglish" },
  { en: "Whisper", zh: "Whisper", tier: "keepEnglish" },
  { en: "FFmpeg", zh: "FFmpeg", tier: "keepEnglish" },
  { en: "FLUX", zh: "FLUX", tier: "keepEnglish" },
  { en: "Veo", zh: "Veo", tier: "keepEnglish" },
  { en: "GPT-4.1", zh: "GPT-4.1", tier: "keepEnglish" },
  { en: "GPT Image", zh: "GPT Image", tier: "keepEnglish" },

  // ── 格式 / 协议（保留）──
  { en: "SRT", zh: "SRT", tier: "keepEnglish" },
  { en: "ASS", zh: "ASS", tier: "keepEnglish" },
  { en: "WebVTT", zh: "WebVTT", tier: "keepEnglish" },
  { en: "MP4", zh: "MP4", tier: "keepEnglish" },
  { en: "MOV", zh: "MOV", tier: "keepEnglish" },
  { en: "JSON", zh: "JSON", tier: "keepEnglish" },
  { en: "FCPXML", zh: "FCPXML", tier: "keepEnglish" },
  { en: "ProRes", zh: "ProRes", tier: "keepEnglish" },

  // ── 会进模型 / Prompt 语法（保留）──
  { en: "Prompt", zh: "提示词", tier: "zhWithEn", enNote: "Prompt", note: "标签用中文，用户输入内容不强制语言" },
  { en: "Negative Prompt", zh: "负向提示", tier: "zhWithEn", enNote: "Negative Prompt" },
  { en: "System Prompt", zh: "系统提示", tier: "zhWithEn", enNote: "System Prompt" },

  // ── 数据结构 / 产品概念（中文 + 括注）──
  { en: "Director Plan", zh: "导演方案", tier: "zhWithEn", enNote: "Director Plan" },
  { en: "EditGraph", zh: "剪辑图", tier: "zhWithEn", enNote: "EditGraph", note: "与 workbench.editGraph 对应" },
  { en: "Story Graph", zh: "故事图谱", tier: "zhWithEn", enNote: "Story Graph" },
  { en: "Timeline", zh: "时间线", tier: "zhWithEn", enNote: "Timeline" },
  { en: "Storyboard", zh: "分镜", tier: "zhOnly" },
  { en: "Multi-Take", zh: "多 Take 方案", tier: "zhWithEn", enNote: "Multi-Take" },
  { en: "Take", zh: "方案", tier: "zhWithEn", enNote: "Take", note: "镜头备选方案语境" },

  // ── 引擎名（中文 + 括注）──
  { en: "Render Engine", zh: "渲染引擎", tier: "zhWithEn", enNote: "Render Engine" },
  { en: "Subtitle Engine", zh: "字幕引擎", tier: "zhWithEn", enNote: "Subtitle Engine" },
  { en: "Voice Engine", zh: "配音引擎", tier: "zhWithEn", enNote: "Voice Engine" },
  { en: "Music Engine", zh: "音乐引擎", tier: "zhWithEn", enNote: "Music Engine" },
  { en: "Transition Engine", zh: "转场引擎", tier: "zhWithEn", enNote: "Transition Engine" },
  { en: "Effect Engine", zh: "特效引擎", tier: "zhWithEn", enNote: "Effect Engine" },
  { en: "Rule Engine", zh: "规则引擎", tier: "zhWithEn", enNote: "Rule Engine" },
  { en: "AI Decision", zh: "AI 剪辑决策", tier: "zhOnly" },

  // ── 领域术语 ──
  { en: "BGM", zh: "背景音乐", tier: "zhWithEn", enNote: "BGM", note: "音乐面板可保留 BGM 缩写" },
  { en: "Ducking", zh: "侧链闪避", tier: "zhWithEn", enNote: "Ducking" },
  { en: "BPM", zh: "BPM 节拍", tier: "zhWithEn", enNote: "BPM" },
  { en: "QC", zh: "质检", tier: "zhOnly", note: "或「画面质检 (Visual QC)」首次括注" },
  { en: "Visual QC", zh: "画面质检", tier: "zhWithEn", enNote: "Visual QC" },
  { en: "Provider", zh: "服务商", tier: "zhWithEn", enNote: "Provider" },
  { en: "Agent", zh: "智能体", tier: "zhOnly", note: "DeepSeek Music Agent → DeepSeek 音乐智能体" },
  { en: "Pipeline", zh: "流水线", tier: "zhOnly" },
  { en: "Preview", zh: "预览", tier: "zhOnly" },
  { en: "Export", zh: "导出", tier: "zhOnly" },
  { en: "Render", zh: "渲染", tier: "zhOnly" },
  { en: "Localization", zh: "多语言本地化", tier: "zhWithEn", enNote: "Localization" },
  { en: "NLE", zh: "非线性剪辑", tier: "zhWithEn", enNote: "NLE" },
  { en: "Concat", zh: "硬切拼接", tier: "zhWithEn", enNote: "Concat" },
  { en: "Fade In", zh: "淡入", tier: "zhOnly" },
  { en: "Fade Out", zh: "淡出", tier: "zhOnly" },
  { en: "Default", zh: "默认", tier: "zhOnly", note: "字幕模板名等" },

  // ── 环境变量（保留原文）──
  { en: "OPENAI_API_KEY", zh: "OPENAI_API_KEY", tier: "keepEnglish" },
  { en: "DEEPSEEK_API_KEY", zh: "DEEPSEEK_API_KEY", tier: "keepEnglish" },

  // ── OpenCut 命令（保留）──
  { en: "insertSubtitle", zh: "insertSubtitle", tier: "keepEnglish", note: "OpenCut 协议命令名" },
];

export function uiLabel(en: string, opts?: { showEnNote?: boolean }): string {
  const entry = UI_GLOSSARY.find((e) => e.en === en);
  if (!entry) return en;
  if (entry.tier === "keepEnglish") return entry.en;
  if (entry.tier === "zhOnly") return entry.zh;
  if (opts?.showEnNote && entry.enNote) return `${entry.zh} (${entry.enNote})`;
  return entry.zh;
}

/** 批量替换说明文案中的英文专名（仅 presentation，不碰 API body） */
export function applyUiGlossaryToText(text: string, showEnNote = false): string {
  let out = text;
  const sorted = [...UI_GLOSSARY].sort((a, b) => b.en.length - a.en.length);
  for (const entry of sorted) {
    if (entry.tier === "keepEnglish") continue;
    const repl = showEnNote && entry.enNote ? `${entry.zh} (${entry.enNote})` : entry.zh;
    out = out.split(entry.en).join(repl);
  }
  return out;
}

export type LocalizationBatch = {
  id: string;
  route: string;
  title: string;
  priority: 1 | 2 | 3;
  englishDensity: "high" | "medium" | "low";
  keyFiles: string[];
  notes: string;
};

/** 改造优先级（P1 先做） */
export const UI_LOCALIZATION_BATCHES: LocalizationBatch[] = [
  {
    id: "canvas-edit-center",
    route: "/canvas",
    title: "画布 · 剪辑中心",
    priority: 1,
    englishDensity: "high",
    keyFiles: [
      "app/components/workflows/canvas/edit-center/EngineRoadmapPanel.tsx",
      "app/components/workflows/canvas/edit-center/PlatformPipelinePanel.tsx",
      "app/components/workflows/canvas/edit-center/StoryGraphPanel.tsx",
      "app/components/workflows/canvas/edit-center/AdvancedEnginePanel.tsx",
      "app/components/workflows/canvas/edit-center/ExportPanel.tsx",
      "app/components/workflows/canvas/edit-center/EditEngineSettingsPanel.tsx",
      "app/lib/auto-edit/engines/roadmap.ts",
    ],
    notes: "英文最集中；改 roadmap.ts 一处可辐射路线图面板",
  },
  {
    id: "ai-video",
    route: "/ai-video",
    title: "创作中心",
    priority: 1,
    englishDensity: "high",
    keyFiles: [
      "app/components/workflows/t2v/T2VWorkbench.tsx",
      "app/components/workflows/t2v/StoryboardImageDashboard.tsx",
      "app/components/workflows/t2v/VideoSettingsPanel.tsx",
      "app/components/workflows/t2v/ConsistencyTimelinePanel.tsx",
      "app/components/workflows/t2v/ProjectCostBreakdownPanel.tsx",
    ],
    notes: "Prompt/QC/模型名：标签中文化，模型 ID 保留",
  },
  {
    id: "ai-director",
    route: "/ai-director",
    title: "AI 导演",
    priority: 1,
    englishDensity: "medium",
    keyFiles: [
      "app/components/ai-director/AiDirectorShell.tsx",
      "app/components/ai-director/DirectorModulesPanel.tsx",
    ],
    notes: "Director Plan / EditGraph 等状态文案",
  },
  {
    id: "centers",
    route: "/voice-center 等",
    title: "配音 / 字幕 / 音乐 / 特效 / 质检中心",
    priority: 2,
    englishDensity: "medium",
    keyFiles: [
      "app/components/voice-center/VoiceCenterShell.tsx",
      "app/components/subtitle-center/SubtitleCenterShell.tsx",
      "app/components/music-center/MusicCenterShell.tsx",
      "app/components/effect-center/EffectCenterShell.tsx",
      "app/components/qa-center/QaCenterShell.tsx",
      "app/**/page.tsx",
    ],
    notes: "页头 Agent 名、Rule Engine、导出格式按钮",
  },
  {
    id: "platform-strip",
    route: "全局",
    title: "ModuleLeadStrip / 模块注册表",
    priority: 2,
    englishDensity: "medium",
    keyFiles: [
      "app/lib/platform/module-registry.ts",
      "app/lib/platform/pipeline-architecture.ts",
      "app/components/platform/ModuleLeadStrip.tsx",
    ],
    notes: "一处修改，多页生效",
  },
  {
    id: "ai-edit",
    route: "/ai-edit",
    title: "自动剪辑 / OpenCut 嵌入",
    priority: 2,
    englishDensity: "medium",
    keyFiles: [
      "app/components/workflows/ai-edit/AiAutoEditShell.tsx",
      "app/components/workflows/ai-edit/OpenCutEditorEmbed.tsx",
    ],
    notes: "OpenCut 本体走 locale；外壳说明可中文化",
  },
  {
    id: "materials-resources",
    route: "/materials",
    title: "素材 / 资源 / 历史",
    priority: 3,
    englishDensity: "low",
    keyFiles: [
      "app/components/materials/MaterialCenter.tsx",
      "app/components/history/HistoryPageClient.tsx",
    ],
    notes: "主体已中文；清理 placeholder 与成本面板英文",
  },
  {
    id: "tui-wire",
    route: "全局",
    title: "接入 tUi / 集中文案",
    priority: 3,
    englishDensity: "low",
    keyFiles: ["app/lib/auto-edit/engines/localization/index.ts"],
    notes: "扩展 MESSAGES.zh，edit-center 逐步改用 tUi",
  },
];
