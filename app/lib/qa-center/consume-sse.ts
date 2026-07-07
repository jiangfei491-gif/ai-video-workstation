import type { EditGraph } from "@/app/lib/auto-edit/edit-graph/types";
import type { QaAutoFixResult, QaCenterResult, QaLiveLogEntry } from "./types";

export type QaSseCompletePayload = {
  result?: QaCenterResult | QaAutoFixResult;
  exportedVideoProbed?: boolean;
  editGraph?: EditGraph;
  editSequence?: unknown;
};

export async function consumeQaSse(
  response: Response,
  handlers: {
    onLog?: (entry: QaLiveLogEntry) => void;
    onComplete?: (data: QaSseCompletePayload) => void;
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

      if (event === "log") {
        handlers.onLog?.(data as QaLiveLogEntry);
      } else if (event === "complete") {
        handlers.onComplete?.(data as QaSseCompletePayload);
      } else if (event === "error") {
        const msg = (data as { error?: string }).error ?? "质检失败";
        handlers.onError?.(msg);
        throw new Error(msg);
      }
    }
  }
}
