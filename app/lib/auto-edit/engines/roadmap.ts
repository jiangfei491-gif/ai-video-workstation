/** AI 剪辑中心 — 产品路线图（与 Render Engine 模块对应） */

export type RoadmapMaturity = "wired" | "usable" | "production";

export type RoadmapItem = {
  id: string;
  title: string;
  phase: 1 | 2 | 3 | 4 | 5;
  /** wired=骨架已接；usable=可日常使用；production=产品级稳定 */
  status: RoadmapMaturity;
  features: string[];
};

export const ROADMAP_STATUS_LABEL: Record<RoadmapMaturity, string> = {
  wired: "已接线",
  usable: "可用",
  production: "产品级",
};

export const RENDER_ENGINE_ROADMAP: RoadmapItem[] = [
  {
    id: "subtitle",
    title: "Subtitle Engine · 字幕引擎",
    phase: 1,
    status: "usable",
    features: [
      "按句切分 + Whisper 打轴",
      "SRT / ASS 导出与烧录",
      "关键词高亮",
      "多语言 Font Profile",
    ],
  },
  {
    id: "voice",
    title: "Voice Engine · 配音引擎",
    phase: 1,
    status: "usable",
    features: [
      "GPT 口播稿",
      "OpenAI / ElevenLabs / Edge",
      "Provider 可用性检测",
      "口播驱动镜长",
    ],
  },
  {
    id: "transition",
    title: "Transition Engine · 转场引擎",
    phase: 1,
    status: "usable",
    features: ["FFmpeg xfade 14 种", "检查器编辑", "默认转场 + 批量应用"],
  },
  {
    id: "music",
    title: "Music Engine · 音乐引擎",
    phase: 1,
    status: "usable",
    features: ["BGM 上传", "侧链 Duck", "Fade", "规则推荐 BGM"],
  },
  {
    id: "ai-decision",
    title: "AI Decision · AI 为什么这样剪",
    phase: 2,
    status: "usable",
    features: ["逐镜理由", "转场理由", "方案对比面板", "Take 评分"],
  },
  {
    id: "storyboard-sync",
    title: "Storyboard ↔ Timeline 联动",
    phase: 2,
    status: "usable",
    features: ["画布同步", "Edit Graph 刷新", "口播节奏镜长"],
  },
  {
    id: "story-graph",
    title: "Story Graph · AI 导演系统",
    phase: 3,
    status: "usable",
    features: ["节点图", "连续性检查", "BPM 卡点应用", "补镜跳转"],
  },
  {
    id: "effect-audio",
    title: "Effect / Audio Engine · 专业版",
    phase: 4,
    status: "usable",
    features: ["锐化/颗粒/暗角", "降噪/响度/压缩", "FCPXML 含媒体路径", "ProRes 实验"],
  },
  {
    id: "localization",
    title: "Localization Engine · 多语言",
    phase: 5,
    status: "usable",
    features: ["术语库", "GPT 翻译字幕", "多 SRT 导出", "语言 Font Profile"],
  },
];

export const SYSTEM_ARCHITECTURE = `
【AI 导演 Agent】内容中心 → 找料 → 脚本 → 分镜 → 画面 → TTS → 字幕
    → 写入 Edit Graph / OpenCut 工程（不点鼠标）
【OpenCut 剪辑引擎】时间线 · 多轨 · 转场 · 音频 · 字幕轨 · 人工微调
【AI 自动剪辑】方案 / 卡点 / BGM / 转场决策 → 回写工程
【导出】OpenCut 导出 或 FFmpeg Render Engine → MP4 / SRT / FCPXML
`.trim();
