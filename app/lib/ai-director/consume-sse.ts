import type { AiDirectorOrchestratorStep, AiDirectorRunResult } from "./types";

export async function consumeAiDirectorSse(
  response: Response,
  handlers: {
    onStep?: (step: AiDirectorOrchestratorStep) => void;
    onComplete?: (data: { result: AiDirectorRunResult }) => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  if (!response.body) throw new Error("无响应流");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      let event = "message";
      let dataStr = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;
      let data: unknown;
      try {
        data = JSON.parse(dataStr);
      } catch {
        continue;
      }

      if (event === "step") {
        handlers.onStep?.(data as AiDirectorOrchestratorStep);
      } else if (event === "complete") {
        handlers.onComplete?.(data as { result: AiDirectorRunResult });
      } else if (event === "error") {
        const msg = (data as { error?: string }).error ?? "AI 导演运行失败";
        handlers.onError?.(msg);
        throw new Error(msg);
      }
    }
  }
}
