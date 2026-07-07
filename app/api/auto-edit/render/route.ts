import { NextResponse } from "next/server";
import {
  buildEditInputFromWorkbench,
  syncClipAssetsFromWorkbench,
  graphToSequence,
} from "@/app/lib/auto-edit";
import { runRenderEngine } from "@/app/lib/auto-edit/render-engine";
import { createEditJob, updateEditJob } from "@/app/lib/auto-edit/edit-job-store";
import { injectBgmIntoGraph } from "@/app/lib/auto-edit/edit-graph/inject-bgm";
import { refreshEditGraphFromWorkbench } from "@/app/lib/auto-edit/edit-graph/refresh-graph";
import type { EditRenderMode, EditSequence } from "@/app/lib/auto-edit/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      workbench: T2VWorkbenchState;
      sequence?: EditSequence;
      mode?: EditRenderMode;
      synthesizeVoice?: boolean;
    };

    const input = buildEditInputFromWorkbench(body.workbench);
    if (!input) {
      return NextResponse.json({ error: "请先运行编导生成分镜" }, { status: 400 });
    }

    const rawSeq = body.sequence ?? body.workbench.editSequence;
    if (!rawSeq?.playOrder?.length) {
      return NextResponse.json({ error: "请先生成剪辑方案" }, { status: 400 });
    }

    const sequence = syncClipAssetsFromWorkbench(rawSeq, input);
    const refreshed = refreshEditGraphFromWorkbench(body.workbench);
    const editGraph = injectBgmIntoGraph(
      refreshed ?? body.workbench.editGraph,
      body.workbench.editBgmUrl,
      body.workbench.editBgmVolume
    );

    const job = createEditJob();
    updateEditJob(job.id, {
      status: "rendering",
      message: "渲染引擎准备中…",
      progress: 0,
    });

    void runRenderJob(job.id, {
      sequence,
      editTimeline: editGraph?.timeline,
      mediaPool: editGraph?.mediaPool,
      aspectRatio: body.workbench.aspectRatio,
      fps: body.workbench.fps,
      mode: body.mode ?? body.workbench.editRenderMode ?? "mixed",
      bgmUrl: body.workbench.editBgmUrl,
      bgmVolume: body.workbench.editBgmVolume,
      voiceId: body.workbench.editVoiceId,
      voiceProvider: body.workbench.editEngineSettings?.voice.provider,
      engineSettings: body.workbench.editEngineSettings,
      synthesizeVoice: body.synthesizeVoice !== false,
    });

    return NextResponse.json({ jobId: job.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

async function runRenderJob(
  jobId: string,
  params: Parameters<typeof runRenderEngine>[0]
): Promise<void> {
  try {
    const result = await runRenderEngine({
      ...params,
      onProgress: (pct, msg) =>
        updateEditJob(jobId, { status: "rendering", progress: pct, message: msg }),
    });

    updateEditJob(jobId, {
      status: "success",
      progress: 100,
      message: skippedMsg(result.skippedKeys),
      outputUrl: result.outputUrl,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    updateEditJob(jobId, {
      status: "failed",
      progress: 0,
      message: "渲染失败",
      error: err instanceof Error ? err.message : String(err),
      completedAt: new Date().toISOString(),
    });
  }
}

function skippedMsg(keys: string[]): string {
  if (keys.length === 0) return "渲染完成";
  return `渲染完成（跳过 ${keys.length} 个缺素材镜头）`;
}
