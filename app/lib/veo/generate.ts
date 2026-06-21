import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import type { GenerationMode } from "@/app/lib/generation-mode";
import {
  DEFAULT_PRODUCTION_DURATION_SEC,
  resolveDurationForMode,
} from "@/app/lib/generation-mode";
import type { VeoGenerateRequest } from "@/app/lib/shot-lock";
import {
  getShotLockById,
  ShotLockValidationError,
  updateProductionResult,
  validateProductionRequest,
} from "@/app/lib/shot-lock";
import {
  expandAllRefsFromStore,
  readImageBuffer,
  saveFirstFrameAsset,
  saveVideoClipAsset,
} from "@/app/lib/asset-library";
import { isPreviewMode } from "@/app/lib/workspace-mode";
import { extractFirstFrameFromVideo } from "./first-frame";
import { generateVeoVideoFromPrompt, VeoApiError } from "./client";
import { assertVeoConfigured, getVeoConfig, isVeoConfigured } from "./config";

export type VeoGenerateResult = {
  taskId: string;
  status: "completed" | "failed";
  videoUrl: string | null;
  firstFrameUrl?: string;
  firstFrameAssetId?: string;
  provider: "veo";
  workspaceMode: VeoGenerateRequest["workspaceMode"];
  mode: GenerationMode;
  type: VeoGenerateRequest["type"];
  seed: number;
  error?: string;
  shotLockId?: string;
};

function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

function bufferToDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function extractPreviewFirstFrame(
  videoBuffer: Buffer,
  shotId: string
): string | undefined {
  const tmpVideo = path.join(os.tmpdir(), `veo-${shotId}-${randomUUID()}.mp4`);
  const tmpFrame = path.join(os.tmpdir(), `frame-${shotId}-${randomUUID()}.png`);
  try {
    fs.writeFileSync(tmpVideo, videoBuffer);
    extractFirstFrameFromVideo(tmpVideo, tmpFrame);
    const frameBuffer = fs.readFileSync(tmpFrame);
    return bufferToDataUrl(frameBuffer, "image/png");
  } catch {
    return undefined;
  } finally {
    for (const fp of [tmpVideo, tmpFrame]) {
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch {
        /* ignore */
      }
    }
  }
}

export async function generateWithVeo(
  request: VeoGenerateRequest
): Promise<VeoGenerateResult> {
  const config = getVeoConfig();
  if (!isVeoConfigured(config)) {
    return {
      taskId: `veo-unconfigured-${Date.now()}`,
      status: "failed",
      videoUrl: null,
      provider: "veo",
      workspaceMode: request.workspaceMode,
      mode: request.mode,
      type: request.type,
      seed: request.seed ?? randomSeed(),
      error: "未配置 VEO_API_KEY",
    };
  }

  assertVeoConfigured(config);

  const preview = isPreviewMode(request.workspaceMode);
  const mode = request.mode;
  const type = request.type;
  const durationSec =
    request.durationSec ??
    (mode === "production" && request.shotLockId
      ? undefined
      : resolveDurationForMode(mode));

  let seed = request.seed ?? randomSeed();
  let prompt = request.prompt;
  let lockId: string | undefined;

  if (mode === "production") {
    if (preview) {
      throw new ShotLockValidationError("预览模式不支持正式生成");
    }
    if (!request.shotLockId) {
      throw new ShotLockValidationError("正式模式需要镜头锁定 ID");
    }
    const lock = getShotLockById(request.shotLockId);
    if (!lock) throw new ShotLockValidationError("镜头锁定不存在");
    validateProductionRequest(request, lock);
    seed = lock.snapshot.seed;
    prompt = lock.snapshot.prompt;
    lockId = lock.id;
  }

  const finalDuration =
    durationSec ??
    (mode === "production" && request.shotLockId
      ? getShotLockById(request.shotLockId!)!.snapshot.duration
      : resolveDurationForMode(mode));

  // 图生视频：把参考图（角色首帧）作为首帧真正传给 Veo，做一致性锚定
  let referenceImage: { bytesBase64Encoded: string; mimeType: string } | undefined;
  if (type === "i2v") {
    if (request.imageAssetId) {
      const buf = readImageBuffer(request.imageAssetId);
      referenceImage = {
        bytesBase64Encoded: buf.toString("base64"),
        mimeType: "image/png",
      };
    } else if (request.imageBase64?.trim()) {
      referenceImage = {
        bytesBase64Encoded: request.imageBase64.replace(
          /^data:image\/[^;]+;base64,/,
          ""
        ),
        mimeType: "image/png",
      };
    } else if (mode === "test" && !preview) {
      throw new Error("图生视频需要参考图资源");
    } else if (preview) {
      throw new Error("预览模式图生视频需要参考图片");
    }
  }

  // 生成前最后一刻：展开 @角色名 → 外观描述，做跨镜头一致性锚定
  // （用户编辑器里始终保留干净的 @名字）
  prompt = expandAllRefsFromStore(prompt);

  try {
    const { taskId, buffer } = await generateVeoVideoFromPrompt(
      prompt,
      undefined,
      finalDuration,
      referenceImage
    );

    if (preview) {
      const firstFrameUrl =
        mode === "test" ? extractPreviewFirstFrame(buffer, request.shotId) : undefined;
      return {
        taskId,
        status: "completed",
        videoUrl: bufferToDataUrl(buffer, "video/mp4"),
        firstFrameUrl,
        provider: "veo",
        workspaceMode: request.workspaceMode,
        mode,
        type,
        seed,
      };
    }

    const clip = saveVideoClipAsset({
      shotId: request.shotId,
      mode,
      buffer,
      taskId,
      durationSec: finalDuration,
    });

    let firstFrameUrl: string | undefined;
    let firstFrameAssetId: string | undefined;

    if (mode === "test" && fs.existsSync(clip.filepath) && buffer.length > 20) {
      const tmpFrame = path.join(os.tmpdir(), `frame-${randomUUID()}.png`);
      try {
        extractFirstFrameFromVideo(clip.filepath, tmpFrame);
        const frameBuffer = fs.readFileSync(tmpFrame);
        const ff = saveFirstFrameAsset({
          shotId: request.shotId,
          sourceClipUrl: clip.publicUrl,
          buffer: frameBuffer,
        });
        firstFrameUrl = ff.publicUrl;
        firstFrameAssetId = ff.id;
      } catch {
        /* skip */
      } finally {
        try {
          if (fs.existsSync(tmpFrame)) fs.unlinkSync(tmpFrame);
        } catch {
          /* ignore */
        }
      }
    }

    if (mode === "production" && lockId) {
      updateProductionResult(lockId, taskId, clip.publicUrl);
    }

    return {
      taskId,
      status: "completed",
      videoUrl: clip.publicUrl,
      firstFrameUrl,
      firstFrameAssetId,
      provider: "veo",
      workspaceMode: request.workspaceMode,
      mode,
      type,
      seed,
      shotLockId: lockId,
    };
  } catch (err) {
    const message =
      err instanceof VeoApiError || err instanceof ShotLockValidationError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return {
      taskId: `veo-failed-${Date.now()}`,
      status: "failed",
      videoUrl: null,
      provider: "veo",
      workspaceMode: request.workspaceMode,
      mode,
      type,
      seed,
      error: message,
    };
  }
}

export { DEFAULT_PRODUCTION_DURATION_SEC };
