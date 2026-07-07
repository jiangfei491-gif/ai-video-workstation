import { NextResponse } from "next/server";
import { runAiDirectorOrchestrator } from "@/app/lib/ai-director/run-orchestrator";
import { encodeSseEvent, sseResponse } from "@/app/lib/qa-center/sse";
import type { AiDirectorRunOptions } from "@/app/lib/ai-director/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;

type RunBody = {
  workbench: T2VWorkbenchState;
  options?: AiDirectorRunOptions;
};

/** 一键运行 AI 导演：编导 → EditGraph → Director Plan（?stream=1 SSE） */
export async function POST(req: Request) {
  const stream = new URL(req.url).searchParams.get("stream") === "1";

  if (!getOpenAIApiKey()) {
    return NextResponse.json({ error: "未配置 OPENAI_API_KEY" }, { status: 503 });
  }

  try {
    const body = (await req.json()) as RunBody;
    if (!body.workbench) {
      return NextResponse.json({ error: "缺少 workbench" }, { status: 400 });
    }

    if (stream) {
      const sseStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const push = (event: string, data: unknown) => {
            controller.enqueue(encodeSseEvent(event, data));
          };
          try {
            const result = await runAiDirectorOrchestrator(
              body.workbench,
              body.options,
              (step) => push("step", step),
              req.signal
            );
            if (result.status === "failed") {
              push("error", { error: result.error ?? "AI 导演运行失败", result });
            } else {
              push("complete", { result });
            }
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
              push("error", { error: "已停止" });
            } else {
              push("error", {
                error: err instanceof Error ? err.message : String(err),
              });
            }
          } finally {
            controller.close();
          }
        },
      });
      return sseResponse(sseStream);
    }

    const result = await runAiDirectorOrchestrator(body.workbench, body.options);
    if (result.status === "failed") {
      return NextResponse.json({ error: result.error, result }, { status: 500 });
    }
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
