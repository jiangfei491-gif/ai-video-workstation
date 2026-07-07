import { NextResponse } from "next/server";
import { resolveMediaFilePath } from "@/app/lib/auto-edit/resolve-media";
import { refreshEditGraphFromWorkbench } from "@/app/lib/auto-edit/edit-graph/refresh-graph";
import { buildTimelineQaSummary, runQaCenterTask } from "@/app/lib/qa-center";
import { encodeSseEvent, sseResponse } from "@/app/lib/qa-center/sse";
import type { QaDirectorTask } from "@/app/lib/qa-center/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type WorkbenchBody = {
  workbench: T2VWorkbenchState;
  optimizeWithAi?: boolean;
  scoreThreshold?: number;
  probeExportedVideo?: boolean;
};

function buildTask(body: WorkbenchBody) {
  const graph = refreshEditGraphFromWorkbench(body.workbench);
  if (!graph?.timeline) {
    return { error: "请先生成剪辑时间线" as const };
  }

  const summary = buildTimelineQaSummary(graph);
  const exportedVideoPath =
    body.probeExportedVideo !== false && body.workbench.finalEditVideoUrl
      ? resolveMediaFilePath(body.workbench.finalEditVideoUrl)
      : null;

  const task: QaDirectorTask = {
    id: `project-${Date.now()}`,
    durationSec: graph.timeline.durationSec,
    aspectRatio: graph.timeline.aspectRatio,
    pacingProfile: graph.pacingProfile,
    script: graph.timeline.subtitle.map((c) => c.subtitle?.text ?? "").join("\n"),
    optimizeWithAi: body.optimizeWithAi !== false,
    scoreThreshold: body.scoreThreshold ?? 75,
    exportedVideoPath,
    timelineSummary: summary,
  };

  return { graph, summary, task, exportedVideoPath };
}

/** 质检中心 — 检测当前项目时间线 / 导出成片（支持 ?stream=1 SSE 实时日志） */
export async function POST(req: Request) {
  const stream = new URL(req.url).searchParams.get("stream") === "1";

  try {
    const body = (await req.json()) as WorkbenchBody;
    const built = buildTask(body);
    if ("error" in built) {
      return NextResponse.json({ error: built.error }, { status: 400 });
    }

    const { summary, task, exportedVideoPath } = built;

    if (stream) {
      const sseStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const push = (event: string, data: unknown) => {
            controller.enqueue(encodeSseEvent(event, data));
          };
          try {
            const result = await runQaCenterTask(task, summary, {
              onLiveLog: (entry) => push("log", entry),
            });
            if (result.status === "failed") {
              push("error", { error: result.error ?? "质检失败", result });
            } else {
              push("complete", {
                result,
                exportedVideoProbed: Boolean(exportedVideoPath),
              });
            }
          } catch (err) {
            push("error", {
              error: err instanceof Error ? err.message : String(err),
            });
          } finally {
            controller.close();
          }
        },
      });
      return sseResponse(sseStream);
    }

    const result = await runQaCenterTask(task, summary);
    if (result.status === "failed") {
      return NextResponse.json({ error: result.error, result }, { status: 500 });
    }

    return NextResponse.json({
      result,
      exportedVideoProbed: Boolean(exportedVideoPath),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
