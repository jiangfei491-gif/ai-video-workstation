export type RouteActivityMeta = {
  moduleId: string;
  moduleLabel: string;
  actor: string;
  startMessage: string;
};

const ROUTES: { test: RegExp; meta: RouteActivityMeta }[] = [
  {
    test: /\/api\/ai-director\/run\b/,
    meta: {
      moduleId: "ai-director",
      moduleLabel: "AI 导演",
      actor: "GPT-4.1",
      startMessage: "一键运行 AI 导演…",
    },
  },
  {
    test: /\/api\/director\b/,
    meta: {
      moduleId: "ai-director",
      moduleLabel: "AI 导演",
      actor: "GPT-4.1",
      startMessage: "编导规划分镜…",
    },
  },
  {
    test: /\/api\/materials\/script\b/,
    meta: {
      moduleId: "material-center",
      moduleLabel: "内容中心",
      actor: "Claude / GPT",
      startMessage: "生成素材脚本…",
    },
  },
  {
    test: /\/api\/materials\/evolve\b/,
    meta: {
      moduleId: "material-center",
      moduleLabel: "内容中心",
      actor: "脚本进化",
      startMessage: "脚本进化 V2…",
    },
  },
  {
    test: /\/api\/veo\/generate\b/,
    meta: {
      moduleId: "video-creation-media",
      moduleLabel: "创作中心",
      actor: "Veo",
      startMessage: "生成视频…",
    },
  },
  {
    test: /\/api\/consistency-engine\b/,
    meta: {
      moduleId: "video-creation-media",
      moduleLabel: "创作中心",
      actor: "一致性引擎",
      startMessage: "镜头一致性生成…",
    },
  },
  {
    test: /\/api\/voice-center\/workbench\b/,
    meta: {
      moduleId: "voice-center",
      moduleLabel: "配音中心",
      actor: "TTS 引擎",
      startMessage: "批量合成配音…",
    },
  },
  {
    test: /\/api\/subtitle-center\/workbench\b/,
    meta: {
      moduleId: "subtitle-center",
      moduleLabel: "字幕中心",
      actor: "DeepSeek",
      startMessage: "生成/优化字幕…",
    },
  },
  {
    test: /\/api\/music-center\/workbench\b/,
    meta: {
      moduleId: "music-center",
      moduleLabel: "音乐中心",
      actor: "DeepSeek Music",
      startMessage: "挂载 BGM…",
    },
  },
  {
    test: /\/api\/effect-center\/workbench\b/,
    meta: {
      moduleId: "effect-center",
      moduleLabel: "特效中心",
      actor: "DeepSeek Effect",
      startMessage: "应用转场/特效…",
    },
  },
  {
    test: /\/api\/qa-center\/auto-fix\b/,
    meta: {
      moduleId: "qa-center",
      moduleLabel: "质检中心",
      actor: "定点自动修复",
      startMessage: "执行定点自动修复…",
    },
  },
  {
    test: /\/api\/qa-center\/workbench\b/,
    meta: {
      moduleId: "qa-center",
      moduleLabel: "质检中心",
      actor: "DeepSeek QA",
      startMessage: "运行成片质检…",
    },
  },
  {
    test: /\/api\/auto-edit\/auto-pipeline\b/,
    meta: {
      moduleId: "clip-agent",
      moduleLabel: "剪辑 Agent",
      actor: "Auto Edit",
      startMessage: "自动剪辑流水线…",
    },
  },
  {
    test: /\/api\/auto-edit\/render\b/,
    meta: {
      moduleId: "opencut",
      moduleLabel: "OpenCut",
      actor: "渲染引擎",
      startMessage: "渲染导出…",
    },
  },
  {
    test: /\/api\/auto-edit\/export\b/,
    meta: {
      moduleId: "opencut",
      moduleLabel: "OpenCut",
      actor: "导出引擎",
      startMessage: "导出成片…",
    },
  },
];

export function resolveRouteActivityMeta(url: string): RouteActivityMeta | null {
  for (const row of ROUTES) {
    if (row.test.test(url)) return row.meta;
  }
  return null;
}

export function getModuleLabel(moduleId: string): string {
  const hit = ROUTES.find((r) => r.meta.moduleId === moduleId);
  return hit?.meta.moduleLabel ?? moduleId;
}
