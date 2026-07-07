import { NextResponse } from "next/server";
import { buildEditInputFromWorkbench, graphToSequence } from "@/app/lib/auto-edit";
import { rebuildDerivedTracks } from "@/app/lib/auto-edit/edit-graph";
import { refreshEditGraphFromWorkbench } from "@/app/lib/auto-edit/edit-graph/refresh-graph";
import { alignSubtitlesWithWhisper } from "@/app/lib/auto-edit/audio/transcribe-align";
import { runSubtitleCenterTask } from "@/app/lib/subtitle-center";
import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";
import type { SubtitleEngineOptions } from "@/app/lib/auto-edit/engines/types";
import type { SubtitleCenterLanguage, SubtitleStyleTemplate, SubtitleAnimationId } from "@/app/lib/subtitle-center/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** 字幕中心 — 为当前项目生成/优化字幕并写回 EditGraph */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      workbench: T2VWorkbenchState;
      language?: SubtitleCenterLanguage;
      styleTemplate?: SubtitleStyleTemplate;
      animation?: SubtitleAnimationId;
      optimizeWithAi?: boolean;
      whisperAlign?: boolean;
      options?: SubtitleEngineOptions;
    };

    const input = buildEditInputFromWorkbench(body.workbench);
    if (!input) {
      return NextResponse.json({ error: "请先运行编导生成分镜" }, { status: 400 });
    }

    let graph = refreshEditGraphFromWorkbench(body.workbench);
    if (!graph?.timeline) {
      return NextResponse.json({ error: "请先生成剪辑时间线" }, { status: 400 });
    }

    const { timeline } = rebuildDerivedTracks(graph.timeline, input);
    graph = { ...graph, timeline };

    if (body.whisperAlign !== false && graph.timeline.voice.length > 0) {
      const aligned = await alignSubtitlesWithWhisper(
        graph.timeline,
        graph.mediaPool,
        () => undefined
      );
      graph = { ...graph, timeline: aligned };
    }

    if (graph.timeline.subtitle.length === 0) {
      return NextResponse.json(
        { error: "字幕轨为空，请先在配音中心生成配音，或确保口播稿已就绪" },
        { status: 400 }
      );
    }

    const engineSettings = body.workbench.editEngineSettings?.subtitle;
    const task = {
      id: `project-${Date.now()}`,
      script: graph.timeline.subtitle.map((c) => c.subtitle?.text ?? "").join("\n"),
      language: body.language ?? engineSettings?.primaryLang ?? "zh",
      styleTemplate: body.styleTemplate ?? "tiktok",
      animation: body.animation ?? "fade",
      optimizeWithAi: body.optimizeWithAi ?? true,
      sentenceTimestamp: graph.timeline.subtitle.map((c) => ({
        text: c.subtitle?.text ?? "",
        startSec: c.startSec,
        endSec: c.startSec + c.durationSec,
      })),
      maxCharsPerLine: body.options?.maxCharsPerLine ?? engineSettings?.maxCharsPerLine,
      maxLines: body.options?.maxLines ?? engineSettings?.maxLines,
      highlightKeywords: body.options?.highlightKeywords ?? engineSettings?.highlightKeywords,
      engineOptions: body.options,
      playRes: { w: 1080, h: body.workbench.aspectRatio === "16:9" ? 608 : 1920 },
    };

    const result = await runSubtitleCenterTask(task);
    if (result.status === "failed") {
      return NextResponse.json({ error: result.error, result }, { status: 500 });
    }

    const nextGraph: EditGraph = {
      ...graph,
      timeline: {
        ...graph.timeline,
        subtitle: result.subtitle,
      },
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      editGraph: nextGraph,
      editSequence: graphToSequence(nextGraph),
      result,
      openCutCommands: result.openCut.commands,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
