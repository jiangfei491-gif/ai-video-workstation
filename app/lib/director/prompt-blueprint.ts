/**
 * Prompt 蓝图 —— 借鉴抖音「填空法」教程（景别 / 主体 / 动作 / 场景 / 光线 / 风格）。
 * 把"靠感觉写提示词"变成"填空出专业提示词"。
 *
 * 此模块为客户端安全（纯函数 + 常量，无服务端依赖），
 * 同时被填空构建器 UI 与参考图反推服务复用。
 */

/** 一条镜头提示词的结构化拆解 */
export type PromptBlueprint = {
  /** 景别：close-up / medium shot / wide shot ... */
  shot: string;
  /** 主体：谁/什么 */
  subject: string;
  /** 动作：在做什么 */
  action: string;
  /** 场景/环境 */
  scene: string;
  /** 光线/氛围 */
  lighting: string;
  /** 风格 */
  style: string;
};

export const EMPTY_BLUEPRINT: PromptBlueprint = {
  shot: "",
  subject: "",
  action: "",
  scene: "",
  lighting: "",
  style: "",
};

/** 预设词条：中文标签 → 注入 Prompt 的英文 token */
export type PresetChip = { label: string; value: string };

export const SHOT_PRESETS: PresetChip[] = [
  { label: "特写", value: "extreme close-up shot" },
  { label: "近景", value: "close-up shot" },
  { label: "中景", value: "medium shot" },
  { label: "全景", value: "wide shot" },
  { label: "远景", value: "extreme wide establishing shot" },
  { label: "航拍", value: "aerial drone shot" },
  { label: "第一人称", value: "first-person POV shot" },
  { label: "过肩", value: "over-the-shoulder shot" },
  { label: "低角度", value: "low-angle shot" },
  { label: "俯拍", value: "high-angle top-down shot" },
];

export const LIGHTING_PRESETS: PresetChip[] = [
  { label: "自然光", value: "natural daylight" },
  { label: "柔光", value: "soft diffused light" },
  { label: "逆光", value: "backlit silhouette" },
  { label: "黄金时刻", value: "golden hour warm light" },
  { label: "霓虹夜景", value: "neon-lit night ambiance" },
  { label: "阴天", value: "overcast soft shadows" },
  { label: "影棚布光", value: "dramatic studio lighting" },
  { label: "烛光", value: "warm candlelight" },
];

export const STYLE_PRESETS: PresetChip[] = [
  { label: "电影感", value: "cinematic, photorealistic" },
  { label: "写实纪录", value: "documentary realism" },
  { label: "动画", value: "stylized animation" },
  { label: "赛博朋克", value: "cyberpunk aesthetic" },
  { label: "复古胶片", value: "vintage film grain" },
  { label: "梦幻", value: "dreamy ethereal" },
  { label: "极简", value: "minimalist clean" },
];

/**
 * 把蓝图拼装成一条 Veo text-to-video 英文提示词。
 * 顺序遵循「填空法」：景别 → 主体+动作 → 场景 → 光线 → 风格 + 收尾约束。
 */
export function assembleBlueprint(bp: PromptBlueprint): string {
  const parts: string[] = [];

  // 景别 + 主体 + 动作（核心从句）
  const core = [bp.subject.trim(), bp.action.trim()].filter(Boolean).join(" ");
  if (bp.shot.trim() && core) {
    parts.push(`${bp.shot.trim()} of ${core}`);
  } else if (bp.shot.trim()) {
    parts.push(bp.shot.trim());
  } else if (core) {
    parts.push(core);
  }

  if (bp.scene.trim()) parts.push(`in ${bp.scene.trim()}`);
  if (bp.lighting.trim()) parts.push(bp.lighting.trim());
  if (bp.style.trim()) parts.push(bp.style.trim());

  if (parts.length === 0) return "";

  // 收尾约束：竖屏 + 连贯运动
  parts.push("vertical 9:16, smooth natural motion");
  return parts.join(", ") + ".";
}

/** 蓝图是否还是空的（没有任何有效字段） */
export function isBlueprintEmpty(bp: PromptBlueprint): boolean {
  return Object.values(bp).every((v) => !v.trim());
}
