import { listCharacters, listProps, listScenes } from "@/app/lib/asset-library";
import {
  buildCompatImageTasksFromDirector,
  buildShotFrameRequestFromImageTask,
  dualWriteGenerationResult,
  imageTaskHasFrame,
  assertImageBudgetCompliance,
} from "@/app/lib/image-task";
import { mergeShotCostIntoLedger } from "@/app/lib/cost-ledger/merge";
import { resolveEffectiveAspectRatio } from "@/app/lib/generation-params";
import type { ShotPipelineCostDetail } from "@/app/lib/cost-ledger/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import { generateShotFrame } from "@/app/lib/director/generate-shot-frame";
import type { ImageTask } from "@/app/lib/image-task/types";

const BATCH_CONCURRENCY = 3;

export type BatchImageStepResult = {
  shotIndex: number;
  imageTaskId: string;
  status: "done" | "failed" | "skipped";
  message: string;
};

export type BatchImagePipelineResult = {
  steps: BatchImageStepResult[];
  workbenchPatch: Partial<T2VWorkbenchState>;
  generated: number;
  failed: number;
};

function loadResourceRefs() {
  return {
    characters: listCharacters().map((c) => ({ id: c.id, name: c.name })),
    scenes: listScenes().map((s) => ({ id: s.id, name: s.name })),
    props: listProps().map((p) => ({ id: p.id, name: p.name })),
  };
}

function resolveImageTasks(state: T2VWorkbenchState, director: NonNullable<T2VWorkbenchState["director"]>): ImageTask[] {
  if (state.imageTasks?.length) return state.imageTasks;
  return buildCompatImageTasksFromDirector({ director }).imageTasks;
}

/** 批量文生图（t2i）：按 ImageTask 逐任务生成，双写 shotFrames 兼容旧模块 */
export async function runBatchShotImages(
  state: T2VWorkbenchState,
  opts?: {
    forceRegenerate?: boolean;
    onShot?: (step: BatchImageStepResult) => void;
    signal?: AbortSignal;
  }
): Promise<BatchImagePipelineResult> {
  const director = state.director;
  if (!director?.prompts?.length) {
    throw new Error("请先完成编导分镜");
  }
  if (state.pipelineMode !== "t2i") {
    throw new Error("批量生图仅适用于文生图（t2i）模式");
  }

  const refs = loadResourceRefs();
  const imageTasks = resolveImageTasks(state, director);
  assertImageBudgetCompliance(imageTasks, state.imageBudget ?? 45);
  const total = imageTasks.length;
  const taskIndices = imageTasks
    .map((_, i) => i)
    .filter((i) => opts?.forceRegenerate || !imageTaskHasFrame(state, imageTasks[i]));

  const steps: BatchImageStepResult[] = [];
  let shotFrames = { ...(state.shotFrames ?? {}) };
  let shotFrameAssets = { ...(state.shotFrameAssets ?? {}) };
  let shotImageMeta = { ...(state.shotImageMeta ?? {}) };
  let shotTimeline = { ...(state.shotTimeline ?? {}) };
  let imageTaskFrames = { ...(state.imageTaskFrames ?? {}) };
  let imageTaskFrameAssets = { ...(state.imageTaskFrameAssets ?? {}) };
  let imageTaskTimeline = { ...(state.imageTaskTimeline ?? {}) };
  let projectCostLedger = state.projectCostLedger;

  let generated = 0;
  let failed = 0;

  const push = (step: BatchImageStepResult) => {
    steps.push(step);
    opts?.onShot?.(step);
  };

  for (let i = 0; i < total; i++) {
    if (!taskIndices.includes(i)) {
      const task = imageTasks[i];
      push({
        shotIndex: task.sourceShotIndexes[0] ?? i,
        imageTaskId: task.imageTaskId,
        status: "skipped",
        message: `${task.imageTaskId} 已有画面，跳过`,
      });
    }
  }

  let cursor = 0;
  const worker = async () => {
    while (cursor < taskIndices.length) {
      if (opts?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const ti = taskIndices[cursor++];
      const task = imageTasks[ti];
      const primaryIdx = task.sourceShotIndexes[0] ?? ti;

      try {
        push({
          shotIndex: primaryIdx,
          imageTaskId: task.imageTaskId,
          status: "done",
          message: `${task.imageTaskId} (${ti + 1}/${total}) 生图中…`,
        });

        const body = buildShotFrameRequestFromImageTask(
          state,
          director,
          task,
          refs.characters,
          refs.scenes,
          refs.props,
          "final"
        );
        const result = await generateShotFrame(body);
        const frame = result.frames[0];
        // 准入门：Final QC 未通过(TASK_FAILED) 或无 frame → 不提交资产（跳过 dualWrite）
        if (result.failed || !frame) {
          throw new Error(result.failureReason ?? "生图未通过 Final QC，未产出可用资产");
        }

        const patch = dualWriteGenerationResult({
          task,
          frame,
          timeline: result.timeline as T2VWorkbenchState["shotTimeline"][number] | undefined,
          aspectRatio: resolveEffectiveAspectRatio(state),
          prev: {
            shotFrames,
            shotFrameAssets,
            shotImageMeta,
            shotTimeline,
            imageTaskFrames,
            imageTaskFrameAssets,
            imageTaskTimeline,
          },
        });

        shotFrames = patch.shotFrames ?? shotFrames;
        shotFrameAssets = patch.shotFrameAssets ?? shotFrameAssets;
        shotImageMeta = patch.shotImageMeta ?? shotImageMeta;
        shotTimeline = patch.shotTimeline ?? shotTimeline;
        imageTaskFrames = patch.imageTaskFrames ?? imageTaskFrames;
        imageTaskFrameAssets = patch.imageTaskFrameAssets ?? imageTaskFrameAssets;
        imageTaskTimeline = patch.imageTaskTimeline ?? imageTaskTimeline;

        if (result.costDetail) {
          projectCostLedger = mergeShotCostIntoLedger(
            projectCostLedger,
            result.costDetail as ShotPipelineCostDetail
          );
        }

        generated++;
        push({
          shotIndex: primaryIdx,
          imageTaskId: task.imageTaskId,
          status: "done",
          message: `${task.imageTaskId} (${ti + 1}/${total}) 完成`,
        });
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        push({
          shotIndex: primaryIdx,
          imageTaskId: task.imageTaskId,
          status: "failed",
          message: `${task.imageTaskId} 失败：${msg}`,
        });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(BATCH_CONCURRENCY, taskIndices.length || 1) }, () =>
      worker()
    )
  );

  const imageBatchStatus: Record<
    number,
    { status: "pending" | "generating" | "success" | "failed"; error?: string }
  > = {};
  for (const task of imageTasks) {
    const idx = task.sourceShotIndexes[0] ?? 0;
    const step = steps.find(
      (s) => s.imageTaskId === task.imageTaskId && s.status !== "skipped"
    );
    if (!step) continue;
    imageBatchStatus[idx] =
      step.status === "failed"
        ? { status: "failed", error: step.message }
        : { status: "success" };
  }

  const compat =
    state.imageTasks?.length ?
      null
    : buildCompatImageTasksFromDirector({ director });

  return {
    steps,
    generated,
    failed,
    workbenchPatch: {
      ...(compat
        ? {
            imageTasks: compat.imageTasks,
            imageTaskMapping: compat.mapping,
            director: { ...director, storyboard: compat.storyboardWithShotIds },
          }
        : {}),
      shotFrames,
      shotFrameAssets,
      shotImageMeta,
      shotTimeline,
      imageTaskFrames,
      imageTaskFrameAssets,
      imageTaskTimeline,
      projectCostLedger,
      imageBatchStatus,
      imageBatchRunning: false,
    },
  };
}
