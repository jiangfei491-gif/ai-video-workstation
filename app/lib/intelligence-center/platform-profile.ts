import { APP_NAV_ITEMS } from "@/app/lib/nav-config";

/**
 * 平台能力画像：模块清单从 nav-config 实时读取（不写死），
 * 每个模块附「现在能做啥 / 已用哪些模型库 / 领域关键词」。
 * 驱动：打分相关性、能力去重、抓取词自动生成、接入建议。
 * 平台加/改模块 → 改这里一处即可（模块 nav 里加了但这没画像，会用空默认，仍纳入）。
 */

export interface IcModuleProfile {
  id: string;
  name: string;
  capability: string;
  stack: string[];
  keywords: string[];
}

const PROFILE: Record<string, { capability: string; stack: string[]; keywords: string[] }> = {
  materials: { capability: "内容/素材智能体，脚本与素材流水线", stack: ["DeepSeek"], keywords: ["content agent", "script generation", "asset pipeline"] },
  "ai-director": { capability: "AI 导演：分镜、脚本、镜头规划", stack: ["DeepSeek"], keywords: ["storyboard", "shot planning", "screenplay generation"] },
  "voice-center": { capability: "配音 / 语音合成", stack: ["Edge-TTS", "ElevenLabs"], keywords: ["tts", "text-to-speech", "voice cloning"] },
  "subtitle-center": { capability: "字幕 / 语音识别", stack: ["subdl"], keywords: ["asr", "whisper", "speech recognition", "subtitle"] },
  "music-center": { capability: "配乐 / BGM 生成", stack: ["Jamendo"], keywords: ["music generation", "bgm", "audio generation"] },
  "effect-center": { capability: "特效 / 转场 / 滤镜", stack: ["Pexels"], keywords: ["video effects", "vfx", "video transition"] },
  "qa-center": { capability: "质检 / 内容审核", stack: ["DeepSeek"], keywords: ["video quality assessment", "content moderation"] },
  "ai-video": { capability: "创作中心：文生视频 / 图生视频", stack: ["Veo", "Gemini"], keywords: ["text-to-video", "image-to-video", "video generation", "video diffusion"] },
  "ai-edit": { capability: "AI 剪辑 / 自动成片", stack: ["ffmpeg"], keywords: ["automatic video editing", "cut detection", "video montage"] },
  canvas: { capability: "无限画布 / 节点式工作流", stack: [], keywords: ["node based workflow", "infinite canvas"] },
  resources: { capability: "资源中心：多源素材抓取入库", stack: ["Unsplash", "Pixabay", "Freesound", "Civitai"], keywords: ["stock media", "asset library", "lora"] },
  trends: { capability: "热点 / 趋势发现", stack: [], keywords: ["trending video", "viral"] },
};

// 非能力模块（不参与情报相关性判断）
const EXCLUDE = new Set(["intelligence-center", "history"]);
// 平台全局已集成技术（去重判断用）
const GLOBAL_STACK = ["Veo", "Gemini", "DeepSeek", "Flux", "ffmpeg", "HuggingFace"];

export function getPlatformModules(): IcModuleProfile[] {
  return APP_NAV_ITEMS.filter((it) => !EXCLUDE.has(it.id)).map((it) => ({
    id: it.id,
    name: it.label,
    ...(PROFILE[it.id] ?? { capability: "", stack: [], keywords: [] }),
  }));
}

export function getModuleNames(): string[] {
  return getPlatformModules().map((m) => m.name);
}

/** 已集成技术栈（打分时提示模型：功能重复的降权） */
export function getPlatformStack(): string[] {
  return [...new Set([...GLOBAL_STACK, ...getPlatformModules().flatMap((m) => m.stack)])];
}

// 抓取词优先级：越靠前越核心（保证核心视频能力词进 GitHub 前几块，不被截掉）
const QUERY_PRIORITY = ["ai-video", "ai-edit", "effect-center", "voice-center", "subtitle-center", "music-center"];

/** 平台“兴趣向量”：所有模块关键词去重、核心方向优先（抓取词自动生成用） */
export function getQueryTerms(): string[] {
  const mods = getPlatformModules().slice().sort((a, b) => {
    const ia = QUERY_PRIORITY.indexOf(a.id);
    const ib = QUERY_PRIORITY.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of mods) {
    for (const k of m.keywords) {
      const kk = k.trim();
      if (kk && !seen.has(kk.toLowerCase())) {
        seen.add(kk.toLowerCase());
        out.push(kk);
      }
    }
  }
  return out;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** 给打分模型的平台现状描述（模块+能力+已用技术） */
export function platformStateText(): string {
  const mods = getPlatformModules()
    .map((m) => `${m.name}（${m.capability || "—"}${m.stack.length ? "，已用 " + m.stack.join("/") : ""}）`)
    .join("；");
  return `工作台现有模块及现状：${mods}。已集成技术栈：${getPlatformStack().join("、")}。`;
}
