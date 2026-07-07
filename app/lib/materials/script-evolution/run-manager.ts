import { createRunStore } from "@/app/lib/run-store";
import { consumeEvolutionSse } from "./consume-sse";
import type { EvolutionRun } from "./types";
import type { Material } from "@/app/lib/materials/types";
import { appendClientWorkbenchActivity, patchClientWorkbenchActivity } from "@/app/lib/workbench-activity/client-store";

/**
 * 脚本进化运行管理器（模块级单例）。
 * 进化独立于页面组件——切页/离开内容中心不中断，回来还能看到进度与结果。
 */

export interface EvolutionRunState {
  runningId: string | null; // 正在进化的素材 id
  stage: string | null;
  stats: { candidates: number; rounds: number; outlines: number };
  run: EvolutionRun | null;
  material: Material | null; // 完成时更新后的素材，供组件应用到列表
  seq: number; // 每次完成 +1，组件据此只应用一次
  error: string | null;
}

const store = createRunStore<EvolutionRunState>({
  runningId: null,
  stage: null,
  stats: { candidates: 0, rounds: 0, outlines: 0 },
  run: null,
  material: null,
  seq: 0,
  error: null,
});

export const subscribeEvolutionRun = store.subscribe;
export const getEvolutionRunState = store.get;

/** 关闭结果弹窗 */
export function clearEvolutionRun() {
  store.set({ run: null });
}

export async function startEvolution(id: string, durationMinutes: number): Promise<void> {
  if (store.get().runningId) return;
  store.set({
    runningId: id,
    stage: "启动中…",
    stats: { candidates: 0, rounds: 0, outlines: 0 },
    run: null,
    error: null,
  });
  const act = appendClientWorkbenchActivity({
    moduleId: "materials",
    moduleLabel: "内容中心",
    actor: "脚本进化",
    status: "running",
    message: "脚本进化中…",
  });
  try {
    const res = await fetch("/api/materials/evolve?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, saveToMaterial: true, durationMinutes }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? "脚本进化失败");
    }
    await consumeEvolutionSse(res, {
      onProgress: (data) => {
        store.set({
          stage: data.stage,
          stats: {
            candidates: data.candidateCount ?? 0,
            rounds: data.rounds ?? 0,
            outlines: data.outlineCount ?? 0,
          },
        });
      },
      onComplete: (data) => {
        if (data.run.status !== "completed") {
          throw new Error(data.run.error ?? "脚本进化未完成");
        }
        store.set({
          run: data.run,
          stage: null,
          material: (data.material as Material) ?? null,
          seq: store.get().seq + 1,
        });
      },
      onError: (msg) => {
        throw new Error(msg);
      },
    });
    patchClientWorkbenchActivity(act.id, { status: "success", message: "脚本进化完成" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    store.set({ stage: null, run: null, error: msg });
    patchClientWorkbenchActivity(act.id, { status: "failed", message: "脚本进化失败", detail: msg });
  } finally {
    store.set({ runningId: null });
  }
}
