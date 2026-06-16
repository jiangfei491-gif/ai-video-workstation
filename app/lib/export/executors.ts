import type { T2IWorkbenchState } from "@/app/lib/workbench-persist/t2i-store";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import {
  downloadBlob,
  downloadJson,
  fetchAsUint8Array,
} from "./download";
import {
  IMAGES_PACK_STAGES,
  MEDIA_EXPORT_STAGES,
  PROJECT_EXPORT_STAGES,
} from "./types";
import { createZipBlob } from "./zip";
import { runStagedSteps } from "./run-export";

function slug(name: string): string {
  return (name || "project").replace(/[^\w\u4e00-\u9fa5-]+/g, "_").slice(0, 40);
}

export async function exportT2VProject(
  state: T2VWorkbenchState,
  onProgress: (pct: number, message: string) => void
): Promise<string> {
  const fileName = `project_${slug(state.topic)}.zip`;
  await runStagedSteps(PROJECT_EXPORT_STAGES, onProgress, async () => {
    const projectJson = JSON.stringify(
      {
        topic: state.topic,
        shotCount: state.shotCount,
        shotDurationSec: state.shotDurationSec,
        fps: state.fps,
        aspectRatio: state.aspectRatio,
        clarity: state.clarity,
        director: state.director,
        voiceoverText: state.voiceoverText,
        subtitleText: state.subtitleText,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
    const prompts =
      state.director?.prompts
        .map((p, i) => `镜头${i + 1}:\n${p.providerPrompt}`)
        .join("\n\n") ?? "";
    const config = JSON.stringify(
      {
        workspaceMode: state.workspaceMode,
        characterConsistency: state.characterConsistency,
        sceneConsistency: state.sceneConsistency,
        seedMode: state.seedMode,
        seed: state.seed,
      },
      null,
      2
    );
    const zip = createZipBlob([
      { name: "project.json", data: new TextEncoder().encode(projectJson) },
      { name: "prompts.txt", data: new TextEncoder().encode(prompts) },
      { name: "config.json", data: new TextEncoder().encode(config) },
    ]);
    downloadBlob(zip, fileName);
  });
  return fileName;
}

export async function exportT2VVideo(
  videoUrl: string,
  topic: string,
  onProgress: (pct: number, message: string) => void
): Promise<string> {
  const fileName = `${slug(topic)}_video.mp4`;
  await runStagedSteps(MEDIA_EXPORT_STAGES, onProgress, async () => {
    const data = await fetchAsUint8Array(videoUrl, (p) =>
      onProgress(40 + Math.round(p * 0.45), "正在下载资源...")
    );
    downloadBlob(new Blob([Uint8Array.from(data)], { type: "video/mp4" }), fileName);
  });
  return fileName;
}

export async function exportT2IProject(
  state: T2IWorkbenchState,
  onProgress: (pct: number, message: string) => void
): Promise<string> {
  const fileName = `project_${slug(state.topic)}.zip`;
  await runStagedSteps(PROJECT_EXPORT_STAGES, onProgress, async () => {
    const projectJson = JSON.stringify(
      {
        topic: state.topic,
        prompt: state.prompt,
        style: state.style,
        aspectRatio: state.aspectRatio,
        clarity: state.clarity,
        imageCount: state.imageCount,
        seedMode: state.seedMode,
        seed: state.seed,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
    const zip = createZipBlob([
      { name: "project.json", data: new TextEncoder().encode(projectJson) },
      {
        name: "prompt.txt",
        data: new TextEncoder().encode(state.prompt || state.topic),
      },
    ]);
    downloadBlob(zip, fileName);
  });
  return fileName;
}

export async function exportT2IImagesPack(
  state: T2IWorkbenchState,
  onProgress: (pct: number, message: string) => void
): Promise<string> {
  const fileName = `images_${slug(state.topic)}.zip`;
  const images = state.images;
  if (!images.length) throw new Error("没有可导出的图片");

  await runStagedSteps(IMAGES_PACK_STAGES, onProgress, async () => {
    const files: { name: string; data: Uint8Array }[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      onProgress(
        35 + Math.round((i / images.length) * 40),
        `正在打包图片 ${i + 1}/${images.length}…`
      );
      const data = await fetchAsUint8Array(img.previewUrl);
      const ext = img.previewUrl.includes("png") ? "png" : "jpg";
      files.push({ name: `image_${i + 1}.${ext}`, data });
    }
    const zip = createZipBlob(files);
    downloadBlob(zip, fileName);
  });
  return fileName;
}

/** Fallback single-image export kept for compatibility */
export async function exportSingleImage(
  url: string,
  topic: string,
  onProgress: (pct: number, message: string) => void
): Promise<string> {
  const fileName = `${slug(topic)}.png`;
  await runStagedSteps(MEDIA_EXPORT_STAGES, onProgress, async () => {
    const data = await fetchAsUint8Array(url, (p) =>
      onProgress(40 + Math.round(p * 0.45), "正在下载资源...")
    );
    downloadBlob(new Blob([Uint8Array.from(data)], { type: "image/png" }), fileName);
  });
  return fileName;
}

export { downloadJson };
