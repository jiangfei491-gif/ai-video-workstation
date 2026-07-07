import { NextResponse } from "next/server";
import { buildEditInputFromWorkbench } from "@/app/lib/auto-edit/workbench-bridge";
import { rebuildDerivedTracks } from "@/app/lib/auto-edit/edit-graph";
import { refreshEditGraphFromWorkbench } from "@/app/lib/auto-edit/edit-graph/refresh-graph";
import { translateSubtitleClips } from "@/app/lib/auto-edit/engines/localization/translate-subtitles";
import type { Glossary } from "@/app/lib/auto-edit/engines/localization";
import type { SubtitleLanguage } from "@/app/lib/auto-edit/engines/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      workbench: T2VWorkbenchState;
      targetLang: SubtitleLanguage;
      glossary?: Glossary;
    };

    if (!body.targetLang) {
      return NextResponse.json({ error: "请指定目标语言" }, { status: 400 });
    }

    const input = buildEditInputFromWorkbench(body.workbench);
    if (!input) {
      return NextResponse.json({ error: "请先初始化剪辑时间线" }, { status: 400 });
    }

    const graph = refreshEditGraphFromWorkbench(body.workbench);
    if (!graph?.timeline) {
      return NextResponse.json({ error: "请先初始化剪辑时间线" }, { status: 400 });
    }

    const { timeline } = rebuildDerivedTracks(graph.timeline, input);
    const secondaryTexts = await translateSubtitleClips(
      timeline.subtitle,
      body.targetLang,
      body.glossary
    );

    if (Object.keys(secondaryTexts).length === 0) {
      return NextResponse.json({ error: "翻译失败或无字幕" }, { status: 500 });
    }

    return NextResponse.json({ secondaryTexts, targetLang: body.targetLang, clipCount: Object.keys(secondaryTexts).length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
