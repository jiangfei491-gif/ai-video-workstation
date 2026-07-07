import { NextResponse } from "next/server";
import { buildEditInputFromWorkbench } from "@/app/lib/auto-edit/workbench-bridge";
import { rebuildDerivedTracks } from "@/app/lib/auto-edit/edit-graph";
import { buildAssContent } from "@/app/lib/auto-edit/engines/subtitle-engine";
import { buildSrtContent } from "@/app/lib/auto-edit/engines/subtitle-engine/build-srt";
import { buildExportArtifacts } from "@/app/lib/auto-edit/engines/export-engine";
import { mergeEditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";
import { translateSubtitleClips } from "@/app/lib/auto-edit/engines/localization/translate-subtitles";
import type { Glossary } from "@/app/lib/auto-edit/engines/localization";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";

/** Export Engine：SRT / ASS / FCPXML 工程包 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      workbench: T2VWorkbenchState;
      settings?: ReturnType<typeof mergeEditEngineSettings>;
      glossary?: Glossary;
    };
    const input = buildEditInputFromWorkbench(body.workbench);
    if (!input || !body.workbench.editGraph) {
      return NextResponse.json({ error: "请先初始化剪辑时间线" }, { status: 400 });
    }

    const settings = mergeEditEngineSettings(
      body.settings ?? body.workbench.editEngineSettings
    );
    const { timeline } = rebuildDerivedTracks(body.workbench.editGraph.timeline, input);
    const projectName =
      body.workbench.director?.title?.trim().replace(/\s+/g, "-") || "edit-project";

    let assContent: string | undefined;
    if (settings.export.includeAss && timeline.subtitle.length) {
      assContent = buildAssContent(timeline.subtitle, { w: 1080, h: 1920 }, settings.subtitle);
    }

    let extraArtifacts: { filename: string; content: string }[] = [];
    if (
      settings.localization.enabled &&
      settings.localization.translateSubtitles &&
      settings.localization.targetLanguages.length > 0 &&
      timeline.subtitle.length > 0
    ) {
      for (const lang of settings.localization.targetLanguages) {
        const translated = await translateSubtitleClips(
          timeline.subtitle,
          lang,
          body.glossary
        );
        const clips = timeline.subtitle.map((c) => ({
          ...c,
          subtitle: c.subtitle
            ? { ...c.subtitle, text: translated[c.id] ?? c.subtitle.text }
            : c.subtitle,
        }));
        const langSrt = buildSrtContent(clips, { ...settings.subtitle, primaryLang: lang });
        if (langSrt.trim()) {
          extraArtifacts.push({
            filename: `${projectName}.${lang}.srt`,
            content: langSrt,
          });
        }
      }
    }

    const artifacts = buildExportArtifacts({
      timeline,
      projectName,
      videoUrl: body.workbench.finalEditVideoUrl,
      assContent,
      subtitleOpts: settings.subtitle,
      mediaPool: body.workbench.editGraph.mediaPool,
    }).filter((a) => {
      if (a.kind === "srt" && !settings.export.includeSrt) return false;
      if (a.kind === "ass" && !settings.export.includeAss) return false;
      return a.content || a.url;
    });

    for (const extra of extraArtifacts) {
      artifacts.push({ kind: "srt", filename: extra.filename, content: extra.content });
    }

    return NextResponse.json({ artifacts, projectName });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
