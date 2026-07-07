import { NextResponse } from "next/server";
import { buildEditInputFromWorkbench, graphToSequence } from "@/app/lib/auto-edit";
import { refreshEditGraphFromWorkbench } from "@/app/lib/auto-edit/edit-graph/refresh-graph";
import { applyBeatSyncIfEnabled } from "@/app/lib/music-center/engines/rhythm";
import { buildMediaPoolEntry, runMusicCenterTask } from "@/app/lib/music-center/run-task";
import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";
import type { MusicDirectorTask, MusicStyleTemplate } from "@/app/lib/music-center/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** 音乐中心 — 为当前项目生成 BGM 时间轴并写回 EditGraph */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      workbench: T2VWorkbenchState;
      styleTemplate?: MusicStyleTemplate;
      optimizeWithAi?: boolean;
      baseVolume?: number;
      duckUnderVoice?: boolean;
      duckAmount?: number;
      fadeInSec?: number;
      fadeOutSec?: number;
      beatSync?: boolean;
      bpm?: number;
      bgmFilename?: string;
    };

    let graph = refreshEditGraphFromWorkbench(body.workbench);
    if (!graph?.timeline) {
      return NextResponse.json({ error: "请先生成剪辑时间线" }, { status: 400 });
    }

    const input = buildEditInputFromWorkbench(body.workbench);
    const durationSec = graph.timeline.durationSec;

    const task: MusicDirectorTask = {
      id: `project-${Date.now()}`,
      durationSec,
      pacingProfile: graph.pacingProfile,
      topic: input?.topic ?? body.workbench.topic,
      script: graph.timeline.subtitle.map((c) => c.subtitle?.text ?? "").join("\n"),
      optimizeWithAi: body.optimizeWithAi !== false,
      template: body.styleTemplate,
      baseVolume: body.baseVolume,
      duckUnderVoice: body.duckUnderVoice,
      duckAmount: body.duckAmount,
      fadeInSec: body.fadeInSec,
      fadeOutSec: body.fadeOutSec,
      beatSync: body.beatSync,
      bpm: body.bpm,
      bgmFilename: body.bgmFilename,
      voiceClips: graph.timeline.voice.map((c) => ({
        startSec: c.startSec,
        durationSec: c.durationSec,
      })),
      videoClips: graph.timeline.video.map((c) => ({
        id: c.id,
        startSec: c.startSec,
        durationSec: c.durationSec,
      })),
    };

    const result = await runMusicCenterTask(task);
    if (result.status === "failed" || !result.plan) {
      return NextResponse.json({ error: result.error, result }, { status: 500 });
    }

    const mediaEntry = buildMediaPoolEntry(result.plan, result.mediaRefId);
    const pool = graph.mediaPool.filter((p) => p.id !== result.mediaRefId);
    pool.push(mediaEntry);

    let timeline = {
      ...graph.timeline,
      music: result.music,
    };

    if (body.beatSync && result.plan.bpm) {
      timeline = applyBeatSyncIfEnabled(timeline, result.plan.bpm, true);
    }

    const nextGraph: EditGraph = {
      ...graph,
      mediaPool: pool,
      timeline,
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
