import type { IcPlatformId } from "../types";
import { chunk, getQueryTerms } from "../platform-profile";
import { createSavedSource, listSavedSources } from "./store";

/**
 * 一键铺满：默认源根据「平台能力画像」自动生成（不再写死关键词）。
 * 平台加/改模块 → 关键词随之变 → 抓取方向自动跟着走。
 */

type Preset = { name: string; query: Record<string, string>; intervalMinutes: number };

export function buildPresets(): Record<IcPlatformId, Preset[]> {
  const terms = getQueryTerms(); // 平台“兴趣向量”
  // GitHub 搜索最多 5 个布尔运算符 → 每块 ≤4 词，最多 3 块，覆盖平台各能力方向
  const ghChunks = chunk(terms, 4).slice(0, 3);
  const ghSweep: Preset[] = ghChunks.map((c, i) => ({
    name: `GitHub · 存量${i + 1}（${c[0]}…）`,
    query: { q: `${c.join(" OR ")} stars:>30` },
    intervalMinutes: 360,
  }));
  const ghFresh: Preset = {
    name: "GitHub · 盯新(30天)",
    query: { q: (ghChunks[0] ?? ["text-to-video"]).join(" OR "), days: "30" },
    intervalMinutes: 180,
  };
  // 学术/通用平台不受 5-OR 限制，可用更宽的词
  const broad = terms.slice(0, 8).join(" OR ");

  return {
    github: [...ghSweep, ghFresh],
    huggingface: [{ name: "HuggingFace · 视频/音频模型(最新)", query: { search: "video" }, intervalMinutes: 360 }],
    "ai-video": [{ name: "AI视频 · text-to-video(最新)", query: { pipeline: "text-to-video" }, intervalMinutes: 360 }],
    modelscope: [{ name: "ModelScope · 视频模型", query: { name: "视频" }, intervalMinutes: 720 }],
    arxiv: [{ name: "arXiv · 平台方向(最新)", query: { q: broad || "video generation OR diffusion" }, intervalMinutes: 720 }],
    npm: [{ name: "npm · AI 视频/音频包", query: { text: "ai video generation" }, intervalMinutes: 720 }],
    pypi: [{ name: "PyPI · 最新更新", query: {}, intervalMinutes: 720 }],
    "ai-news": [{ name: "AI资讯 · 视频/生成", query: { query: "AI video OR text-to-video OR video generation" }, intervalMinutes: 360 }],
    comfyui: [{ name: "ComfyUI · 节点扫描", query: {}, intervalMinutes: 720 }],
    mcp: [{ name: "MCP · Server扫描", query: {}, intervalMinutes: 1440 }],
  };
}

/** 为所有平台（或指定平台）播下默认源；按名称去重，已存在则跳过。 */
export function seedDefaultSources(platformId?: IcPlatformId): { created: number; skipped: number } {
  const presets = buildPresets();
  const platforms = platformId ? [platformId] : (Object.keys(presets) as IcPlatformId[]);
  let created = 0;
  let skipped = 0;
  for (const pf of platforms) {
    const existing = new Set(listSavedSources(pf).map((s) => s.name));
    for (const preset of presets[pf] ?? []) {
      if (existing.has(preset.name)) {
        skipped++;
        continue;
      }
      createSavedSource({
        platformId: pf,
        name: preset.name,
        query: preset.query,
        intervalMinutes: preset.intervalMinutes,
        enabled: true,
        autoScore: true, // 默认开自动打分：抓完自动判断价值/去重，达标自动进审核
      });
      created++;
    }
  }
  return { created, skipped };
}
