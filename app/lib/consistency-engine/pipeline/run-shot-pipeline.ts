import fs from "fs";
import { saveImageAsset } from "@/app/lib/asset-library";
import { composeFinalPrompt } from "../composer/prompt-composer";
import { generateImageWithReferences } from "../reference/generate-with-refs";
import { collectReferencePaths } from "../reference/collect-refs";
import { runVisualQC } from "../qc/visual-qc";
import { buildRepairPrompt } from "../repair/auto-repair";
import { recordModelPerformance } from "../performance/model-performance-store";
import type { ComposeInput } from "../types/compose";
import type { ConsistencySettings, ShotTimelineEntry } from "../types/world-style-camera";
import type { QCVerdict } from "../types/qc";
import type { ImageSize } from "@/app/lib/image/gpt-image-2";

export type ShotPipelineInput = ComposeInput & {
  rawDeltaPrompt: string;
  purpose: "final" | "first-frame";
  count: number;
  settings: ConsistencySettings;
};

export type ShotPipelineFrame = {
  url: string;
  assetId: string;
  model: string;
  source: string;
  usedReferences: boolean;
};

export type ShotPipelineResult = {
  frames: ShotPipelineFrame[];
  composed: ReturnType<typeof composeFinalPrompt>;
  finalPrompt: string;
  qc?: QCVerdict;
  timeline: ShotTimelineEntry;
  repairAttempts: number;
};

function aspectToSize(ratio: string): ImageSize {
  if (ratio === "16:9") return "1536x1024";
  if (ratio === "1:1") return "1024x1024";
  return "1024x1536";
}

function suffix(purpose: string): string {
  return purpose === "first-frame"
    ? "Cinematic film still, highly detailed, consistent character design, natural lighting."
    : "High quality still image, complete composition, highly detailed, photorealistic documentary style.";
}

/**
 * Consistency Engine V2 完整流水线：
 * Compose → Reference Generate → QC → Auto Repair → Timeline → Model Performance
 */
export async function runConsistencyShotPipeline(
  input: ShotPipelineInput
): Promise<ShotPipelineResult> {
  const composed = composeFinalPrompt(input);
  let prompt = `${composed.finalPrompt}\n\n${suffix(input.purpose)}`;
  const refs = collectReferencePaths({
    characterIds: input.characterIds,
    sceneId: input.sceneId,
    propIds: input.propIds,
  });
  const refBuffers = refs.paths.map((p) => fs.readFileSync(p));
  const size = aspectToSize(input.aspectRatio);

  let repairAttempts = 0;
  let qc: QCVerdict | undefined;
  let images = await generateImageWithReferences(prompt, refs.paths, size, input.count);
  const started = Date.now();

  if (input.settings.qcEnabled) {
    qc = await runVisualQC({
      imageBuffer: images[0].buffer,
      referenceBuffers: refBuffers,
      composedPrompt: composed.finalPrompt,
    });

    while (
      input.settings.autoRepair &&
      !qc.passed &&
      repairAttempts < input.settings.maxRepairAttempts
    ) {
      repairAttempts++;
      prompt = buildRepairPrompt(prompt, qc);
      images = await generateImageWithReferences(prompt, refs.paths, size, input.count);
      qc = await runVisualQC({
        imageBuffer: images[0].buffer,
        referenceBuffers: refBuffers,
        composedPrompt: composed.finalPrompt,
      });
    }
  }

  const durationMs = Date.now() - started;
  const primary = images[0];

  recordModelPerformance({
    model: primary.model,
    usedReferences: primary.usedReferences,
    qcOverall: qc?.scores.overall ?? 100,
    qcCharacter: qc?.scores.character ?? 100,
    qcStyle: qc?.scores.style ?? 100,
    durationMs,
    passed: qc?.passed ?? true,
  });

  const frames: ShotPipelineFrame[] = images.map((image) => {
    const asset = saveImageAsset({
      prompt,
      buffer: image.buffer,
      model: image.model,
      source: image.source,
      width: size === "1536x1024" ? 1536 : 1024,
      height: size === "1024x1024" ? 1024 : size === "1536x1024" ? 1024 : 1536,
    });
    return {
      url: asset.publicUrl,
      assetId: asset.id,
      model: image.model,
      source: image.source,
      usedReferences: image.usedReferences,
    };
  });

  const timeline: ShotTimelineEntry = {
    shotIndex: input.shotIndex,
    composedPrompt: composed.finalPrompt,
    finalPrompt: prompt,
    frameUrl: frames[0].url,
    assetId: frames[0].assetId,
    model: frames[0].model,
    referencePaths: refs.paths,
    qc,
    repairAttempts,
    deltaChanges: [
      input.shotDelta.action && `动作: ${input.shotDelta.action}`,
      input.shotDelta.camera && `镜头: ${input.shotDelta.camera}`,
      input.shotDelta.lighting && `光线: ${input.shotDelta.lighting}`,
    ].filter(Boolean) as string[],
    createdAt: new Date().toISOString(),
  };

  return { frames, composed, finalPrompt: prompt, qc, timeline, repairAttempts };
}
