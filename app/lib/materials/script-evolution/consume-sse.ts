import type { EvolutionRun } from "@/app/lib/materials/script-evolution/types";

export type SseEvolutionComplete = {
  run: EvolutionRun;
  material: unknown;
};

export async function consumeEvolutionSse(
  response: Response,
  handlers: {
    onProgress?: (data: {
      stage: string;
      status?: string;
      candidateCount?: number;
      outlineCount?: number;
      rounds?: number;
      run?: EvolutionRun;
    }) => void;
    onComplete?: (data: SseEvolutionComplete) => void;
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

      if (event === "progress") {
        handlers.onProgress?.(data as Parameters<NonNullable<typeof handlers.onProgress>>[0]);
      } else if (event === "complete") {
        handlers.onComplete?.(data as SseEvolutionComplete);
      } else if (event === "error") {
        const msg = (data as { error?: string }).error ?? "脚本进化失败";
        handlers.onError?.(msg);
        throw new Error(msg);
      }
    }
  }
}
