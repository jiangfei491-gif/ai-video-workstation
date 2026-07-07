import { NextResponse } from "next/server";
import { graphToSequence } from "@/app/lib/auto-edit";
import { runQaAutoFix } from "@/app/lib/qa-center/run-auto-fix";
import { encodeSseEvent, sseResponse } from "@/app/lib/qa-center/sse";
import type { QaRetryTarget } from "@/app/lib/qa-center/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type AutoFixBody = {
  workbench: T2VWorkbenchState;
  retryTargets: QaRetryTarget[];
  approved: boolean;
  taskId?: string;
};

/** 质检回流 — 用户拍板后定点自动修复（?stream=1 SSE 实时日志） */
export async function POST(req: Request) {
  const stream = new URL(req.url).searchParams.get("stream") === "1";

  try {
    const body = (await req.json()) as AutoFixBody;

    if (!body.approved) {
      return NextResponse.json({
        result: {
          taskId: body.taskId ?? `declined-${Date.now()}`,
          status: "declined" as const,
          steps: [],
        },
      });
    }

    if (!body.retryTargets?.length) {
      return NextResponse.json({ error: "缺少回流建议" }, { status: 400 });
    }

    if (stream) {
      const sseStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const push = (event: string, data: unknown) => {
            controller.enqueue(encodeSseEvent(event, data));
          };
          try {
            const result = await runQaAutoFix({
              workbench: body.workbench,
              retryTargets: body.retryTargets,
              taskId: body.taskId,
              onLiveLog: (entry) => push("log", entry),
            });
            if (result.status === "failed") {
              push("error", { error: result.error ?? "自动修复失败", result });
            } else {
              push("complete", {
                result,
                editGraph: result.editGraph,
                editSequence: result.editSequence ?? (result.editGraph ? graphToSequence(result.editGraph) : undefined),
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

    const result = await runQaAutoFix({
      workbench: body.workbench,
      retryTargets: body.retryTargets,
      taskId: body.taskId,
    });

    if (result.status === "failed") {
      return NextResponse.json({ error: result.error, result }, { status: 500 });
    }

    return NextResponse.json({
      result,
      editGraph: result.editGraph,
      editSequence: result.editSequence ?? (result.editGraph ? graphToSequence(result.editGraph) : undefined),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
