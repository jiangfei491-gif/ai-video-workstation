import { resolveOutputDimensions } from "@/app/lib/generation-params";
import { generateImageWithGptImage2, type ImageSize } from "@/app/lib/image/gpt-image-2";
import { saveImageAsset } from "@/app/lib/asset-library";
import { runTieredShotPipeline } from "@/app/lib/consistency-engine/pipeline/run-tiered-shot-pipeline";
import { shotDeltaFromMeta } from "@/app/lib/consistency-engine/types/shot";
import type { ProjectBible, ShotConsistencyMeta } from "@/app/lib/consistency-engine/types";
import type {
  CameraTemplateId,
  ConsistencySettings,
  StylePresetId,
  WorldBible,
} from "@/app/lib/consistency-engine/types/world-style-camera";
import { DEFAULT_CONSISTENCY_SETTINGS } from "@/app/lib/consistency-engine/types/world-style-camera";
import type { ShotPipelineCostDetail } from "@/app/lib/cost-ledger/types";
import type { ImageTaskQCContext } from "@/app/lib/image-task/qc-context";

export type ShotFrameRequestBody = {
  prompt?: string;
  count?: number;
  style?: string;
  purpose?: "final" | "first-frame";
  compose?: boolean;
  shotIndex?: number;
  imageTaskId?: string;
  imageTaskContext?: ImageTaskQCContext;
  aspectRatio?: string;
  customAspectRatio?: string;
  clarity?: string;
  customClarityWidth?: number;
  customClarityHeight?: number;
  projectBible?: ProjectBible;
  worldBible?: WorldBible;
  stylePresetId?: StylePresetId;
  cameraTemplateId?: CameraTemplateId;
  consistency?: ShotConsistencyMeta;
  previousShotSummary?: string;
  consistencySettings?: ConsistencySettings;
};

export type ShotFrameResult = {
  frames: {
    url: string;
    assetId: string;
    model?: string;
    source?: string;
  }[];
  timeline?: unknown;
  costDetail?: ShotPipelineCostDetail;
  /** Final QC 准入门未通过 → TASK_FAILED（frames 为空，调用方禁止提交资产） */
  failed?: boolean;
  failureReason?: string;
};

function aspectToSize(
  ratio: string | undefined,
  clarity?: string,
  custom?: {
    customAspectRatio?: string;
    customClarityWidth?: number;
    customClarityHeight?: number;
  }
): ImageSize {
  return resolveOutputDimensions({
    aspectRatio: ratio ?? "9:16",
    clarity: clarity ?? "1080p",
    customAspectRatio: custom?.customAspectRatio,
    customClarityWidth: custom?.customClarityWidth,
    customClarityHeight: custom?.customClarityHeight,
  }).openAiSize;
}

/** 单镜生图（与 /api/director/shot-frame 相同逻辑，供 API 与 AI 导演批量调用） */
export async function generateShotFrame(
  body: ShotFrameRequestBody
): Promise<ShotFrameResult> {
  const raw = body.prompt?.trim();
  if (!raw) throw new Error("缺少提示词");

  const count = Math.max(1, Math.min(4, Math.floor(body.count ?? 1)));
  const purpose = body.purpose === "first-frame" ? "first-frame" : "final";
  const meta = body.consistency;
  const settings = body.consistencySettings ?? DEFAULT_CONSISTENCY_SETTINGS;

  if (body.compose && meta) {
    const shotMemory =
      body.previousShotSummary?.trim() &&
      meta.inheritFrom != null &&
      meta.inheritFrom >= 0
        ? {
            inheritFrom: meta.inheritFrom,
            summary: body.previousShotSummary,
            locked: {
              characterIds: meta.characterIds ?? [],
              sceneId: meta.sceneId,
              propIds: meta.propIds ?? [],
            },
          }
        : undefined;

    const result = await runTieredShotPipeline({
      projectBible: body.projectBible ?? {
        videoType: "",
        colorTone: "",
        cameraLanguage: "",
        lightingRules: "",
        forbidden: "",
      },
      worldBible: body.worldBible,
      stylePresetId: body.stylePresetId ?? "custom",
      cameraTemplateId: body.cameraTemplateId ?? "medium_shot",
      aspectRatio: body.aspectRatio ?? "9:16",
      customAspectRatio: body.customAspectRatio,
      clarity: body.clarity,
      customClarityWidth: body.customClarityWidth,
      customClarityHeight: body.customClarityHeight,
      projectStyle: body.style?.trim(),
      characterIds: meta.characterIds ?? [],
      sceneId: meta.sceneId,
      propIds: meta.propIds ?? [],
      shotMemory,
      shotDelta: shotDeltaFromMeta(meta, raw),
      shotIndex: body.shotIndex ?? 0,
      rawDeltaPrompt: raw,
      purpose,
      count,
      settings,
      imageTaskContext: body.imageTaskContext,
    });

    return {
      frames: result.frames,
      timeline: result.timeline,
      costDetail: result.costDetail,
      failed: result.failed,
      failureReason: result.failureReason,
    };
  }

  const suffix =
    purpose === "first-frame"
      ? "Cinematic film still, highly detailed, consistent character design."
      : "High quality still image, photorealistic documentary style.";
  const prompt = [raw, body.style ? `Style: ${body.style}.` : "", suffix]
    .filter(Boolean)
    .join(" ");
  const images = await generateImageWithGptImage2(
    prompt,
    aspectToSize(body.aspectRatio, body.clarity, {
      customAspectRatio: body.customAspectRatio,
      customClarityWidth: body.customClarityWidth,
      customClarityHeight: body.customClarityHeight,
    }),
    count
  );
  const frames = images.map((image) => {
    const asset = saveImageAsset({
      prompt,
      buffer: image.buffer,
      model: image.model,
      source: image.source,
      width: 1024,
      height: 1536,
    });
    return {
      url: asset.publicUrl,
      assetId: asset.id,
      model: image.model,
      source: image.source,
    };
  });
  return { frames };
}
