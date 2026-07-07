import { NextResponse } from "next/server";
import { buildEditInputFromWorkbench, graphToSequence } from "@/app/lib/auto-edit";
import { ensureVoiceClips } from "@/app/lib/auto-edit/audio/ensure-voice-clips";
import { attachTimelineToScriptMap, buildShotFirstScriptMap } from "@/app/lib/auto-edit/edit-graph/build-script-map";
import { refreshEditGraphFromWorkbench } from "@/app/lib/auto-edit/edit-graph/refresh-graph";
import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";
import type { VoiceCenterProviderId, VoiceQualityHint } from "@/app/lib/voice-center";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** 配音中心 — 为当前工作台项目批量合成配音 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      workbench: T2VWorkbenchState;
      voiceId?: string;
      provider?: VoiceCenterProviderId;
      ultraQuality?: boolean;
      quality?: VoiceQualityHint;
    };

    const input = buildEditInputFromWorkbench(body.workbench);
    if (!input) {
      return NextResponse.json({ error: "请先运行编导生成分镜" }, { status: 400 });
    }

    const graph = refreshEditGraphFromWorkbench(body.workbench);
    if (!graph?.timeline) {
      return NextResponse.json({ error: "请先生成剪辑时间线" }, { status: 400 });
    }

    if (graph.timeline.voice.length === 0) {
      return NextResponse.json(
        { error: "配音轨为空，请先在无限画布生成分镜并初始化剪辑时间线" },
        { status: 400 }
      );
    }

    const voiceId =
      body.voiceId ??
      body.workbench.editVoiceId ??
      body.workbench.editEngineSettings?.voice.voiceId;

    const ensured = await ensureVoiceClips({
      timeline: graph.timeline,
      mediaPool: graph.mediaPool,
      voiceId,
      voiceCenterProvider: body.provider,
      ultraQuality: body.ultraQuality,
      quality: body.quality,
    });

    const scriptMap = attachTimelineToScriptMap(
      buildShotFirstScriptMap(input),
      ensured.timeline.video
    );

    const nextGraph: EditGraph = {
      ...graph,
      timeline: ensured.timeline,
      scriptMap,
      mediaPool: ensured.mediaPool,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      editGraph: nextGraph,
      editSequence: graphToSequence(nextGraph),
      synthesized: ensured.synthesized,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
