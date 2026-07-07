import { DEFAULT_PROJECT_BIBLE } from "@/app/lib/consistency-engine/types/bibles";
import { CAMERA_TEMPLATES } from "@/app/lib/consistency-engine/engines/camera-engine";
import { STYLE_PRESETS } from "@/app/lib/consistency-engine/engines/style-engine";
import {
  DEFAULT_WORLD_BIBLE,
  type CameraTemplateId,
  type StylePresetId,
  type WorldBible,
} from "@/app/lib/consistency-engine/types/world-style-camera";
import type { ProjectBible } from "@/app/lib/consistency-engine/types/bibles";
import { directorChatCompletion } from "./director-chat";
import type { TokenCostLine } from "@/app/lib/cost-ledger/types";
import type { InferredVisualSettings } from "./visual-settings-shared";

export type { InferredVisualSettings } from "./visual-settings-shared";
export { isDefaultVisualSettings } from "./visual-settings-shared";

const VALID_STYLE_IDS = new Set<StylePresetId>([
  "custom",
  ...STYLE_PRESETS.map((p) => p.id),
]);

const VALID_CAMERA_IDS = new Set<CameraTemplateId>(
  CAMERA_TEMPLATES.map((c) => c.id)
);

function pickStyleId(raw: unknown): StylePresetId {
  const id = String(raw ?? "").trim() as StylePresetId;
  return VALID_STYLE_IDS.has(id) ? id : "bbc_documentary";
}

function pickCameraId(raw: unknown): CameraTemplateId {
  const id = String(raw ?? "").trim() as CameraTemplateId;
  return VALID_CAMERA_IDS.has(id) ? id : "medium_shot";
}

function str(raw: unknown): string {
  return String(raw ?? "").trim();
}

function normalizeProjectBible(raw: Record<string, unknown>): ProjectBible {
  return {
    videoType: str(raw.videoType),
    colorTone: str(raw.colorTone),
    cameraLanguage: str(raw.cameraLanguage),
    lightingRules: str(raw.lightingRules),
    forbidden: str(raw.forbidden) || DEFAULT_PROJECT_BIBLE.forbidden,
  };
}

function normalizeWorldBible(raw: Record<string, unknown>): WorldBible {
  return {
    era: str(raw.era),
    country: str(raw.country),
    city: str(raw.city),
    architecture: str(raw.architecture),
    transport: str(raw.transport),
    currency: str(raw.currency),
    signage: str(raw.signage),
    uniforms: str(raw.uniforms),
    forbidden: str(raw.forbidden) || DEFAULT_WORLD_BIBLE.forbidden,
  };
}

/**
 * 从主题 / 标题 / 脚本推断项目圣经、风格预设、世界观、默认镜头模板。
 */
export async function inferVisualSettings(input: {
  topic: string;
  title: string;
  script: string;
}): Promise<{ settings: InferredVisualSettings; usage: TokenCostLine }> {
  const styleOptions = STYLE_PRESETS.map((p) => `${p.id}: ${p.label}`).join("\n");
  const cameraOptions = CAMERA_TEMPLATES.map((c) => `${c.id}: ${c.label}`).join("\n");

  const { text, usage } = await directorChatCompletion(
    "visual-settings",
    `你是 AI 视频项目的视觉总监。根据脚本内容推断全片视觉锁定设定，供 Consistency Engine 使用。

必须从下列 ID 中选择 stylePresetId（不要自造 ID）：
${styleOptions}
custom: 以上都不合适时使用

必须从下列 ID 中选择 cameraTemplateId（全片默认主镜头语言）：
${cameraOptions}

返回 JSON：
{
  "projectBible": {
    "videoType": "中文，如：悬疑纪录片 / 都市剧情 / 新闻纪实",
    "colorTone": "中文，如：冷色低饱和 / 暖色电影感",
    "cameraLanguage": "中文，如：手持纪实 / 稳定器跟拍 / 电影推拉",
    "lightingRules": "中文，如：阴天自然光 / 夜景霓虹 / 室内荧光灯",
    "forbidden": "英文逗号分隔禁止项，如 no cartoon, no anime"
  },
  "projectStyle": "英文风格 DNA 短语，如 cold documentary desaturated handheld realism",
  "stylePresetId": "bbc_documentary",
  "worldBible": {
    "era": "年代，如 2018 / 1990s",
    "country": "国家/地区",
    "city": "城市或区域类型",
    "architecture": "建筑风格",
    "transport": "交通工具特征",
    "currency": "货币/支付场景",
    "signage": "招牌语言与风格",
    "uniforms": "制服/着装规范",
    "forbidden": "英文，禁止出现的时代/地域错误元素"
  },
  "cameraTemplateId": "medium_shot"
}

要求：忠实脚本时代、地域、题材与叙事气质；字段具体可执行，不要空泛。`,
    `主题：${input.topic}
标题：${input.title}

脚本：
${input.script.slice(0, 12000)}`,
    { json: true, maxTokens: 1200 }
  );

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("视觉设定推断返回非 JSON");
  }

  return {
    settings: {
      projectBible: normalizeProjectBible(
        (parsed.projectBible as Record<string, unknown>) ?? {}
      ),
      projectStyle: str(parsed.projectStyle),
      stylePresetId: pickStyleId(parsed.stylePresetId),
      worldBible: normalizeWorldBible(
        (parsed.worldBible as Record<string, unknown>) ?? {}
      ),
      cameraTemplateId: pickCameraId(parsed.cameraTemplateId),
    },
    usage,
  };
}
