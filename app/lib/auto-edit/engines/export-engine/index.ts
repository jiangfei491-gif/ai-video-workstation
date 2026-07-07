import type { EditTimeline, MediaPoolItem } from "../../edit-graph/types";
import { resolveMediaFilePath } from "../../resolve-media";
import { buildSrtContent } from "../subtitle-engine/build-srt";
import type { SubtitleEngineOptions } from "../types";

export type ExportArtifact = {
  kind: "mp4" | "mov" | "srt" | "ass" | "fcpxml";
  filename: string;
  content?: string;
  url?: string;
};

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function fileUrlToPath(url: string | undefined): string {
  if (!url) return "";
  const fp = resolveMediaFilePath(url);
  return fp ? `file://${fp}` : url;
}

/** FCPXML 导出（含媒体 src 路径） */
export function buildFcpXml(
  timeline: EditTimeline,
  projectName: string,
  mediaPool: MediaPoolItem[] = []
): string {
  const poolById = new Map(mediaPool.map((p) => [p.id, p]));
  const assetLines: string[] = [];
  const spineLines: string[] = [];
  let assetIdx = 0;

  for (const clip of timeline.video) {
    assetIdx++;
    const ref = `r${assetIdx}`;
    const item = clip.mediaRefId ? poolById.get(clip.mediaRefId) : undefined;
    const src = fileUrlToPath(item?.url ?? clip.video?.mediaUrl);
    assetLines.push(
      `    <asset id="${ref}" name="${escapeXml(clip.label)}" src="${escapeXml(src)}" start="0s" duration="${clip.durationSec}s" hasVideo="1" hasAudio="0"/>`
    );
    spineLines.push(
      `        <video ref="${ref}" offset="${clip.startSec}s" name="${escapeXml(clip.label)}" duration="${clip.durationSec}s"/>`
    );
  }

  for (const clip of timeline.voice) {
    assetIdx++;
    const ref = `r${assetIdx}`;
    const item = clip.mediaRefId ? poolById.get(clip.mediaRefId) : undefined;
    const src = fileUrlToPath(item?.url);
    if (!src) continue;
    assetLines.push(
      `    <asset id="${ref}" name="${escapeXml(clip.label)}" src="${escapeXml(src)}" start="0s" duration="${clip.durationSec}s" hasVideo="0" hasAudio="1"/>`
    );
    spineLines.push(
      `        <audio ref="${ref}" offset="${clip.startSec}s" name="${escapeXml(clip.label)}" duration="${clip.durationSec}s"/>`
    );
  }

  const bgm = timeline.music[0];
  if (bgm) {
    assetIdx++;
    const ref = `r${assetIdx}`;
    const item = bgm.mediaRefId ? poolById.get(bgm.mediaRefId) : undefined;
    const src = fileUrlToPath(item?.url);
    if (src) {
      assetLines.push(
        `    <asset id="${ref}" name="BGM" src="${escapeXml(src)}" start="0s" duration="${bgm.durationSec}s" hasVideo="0" hasAudio="1"/>`
      );
      spineLines.push(
        `        <audio ref="${ref}" offset="${bgm.startSec}s" name="BGM" duration="${bgm.durationSec}s"/>`
      );
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
${assetLines.join("\n")}
  </resources>
  <library>
    <event name="${escapeXml(projectName)}">
      <project name="${escapeXml(projectName)}">
        <sequence duration="${timeline.durationSec}s">
          <spine>
${spineLines.join("\n")}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;
}

export function buildExportArtifacts(params: {
  timeline: EditTimeline;
  projectName: string;
  videoUrl?: string | null;
  assContent?: string;
  subtitleOpts?: SubtitleEngineOptions;
  mediaPool?: MediaPoolItem[];
}): ExportArtifact[] {
  const artifacts: ExportArtifact[] = [];

  if (params.videoUrl) {
    artifacts.push({
      kind: "mp4",
      filename: `${params.projectName}.mp4`,
      url: params.videoUrl,
    });
  }

  const srt = buildSrtContent(params.timeline.subtitle, params.subtitleOpts);
  if (srt.trim()) {
    artifacts.push({ kind: "srt", filename: `${params.projectName}.srt`, content: srt });
  }

  if (params.assContent) {
    artifacts.push({ kind: "ass", filename: `${params.projectName}.ass`, content: params.assContent });
  }

  artifacts.push({
    kind: "fcpxml",
    filename: `${params.projectName}.fcpxml`,
    content: buildFcpXml(params.timeline, params.projectName, params.mediaPool ?? []),
  });

  return artifacts;
}
