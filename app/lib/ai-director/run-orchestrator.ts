import { runAiCutPipeline } from "@/app/lib/ai-cut/run-pipeline";
import { runAutoEditPipeline } from "@/app/lib/auto-edit/run-auto-edit-pipeline";
import { runDirectorPipeline } from "@/app/lib/director";
import type { DirectorPipelineStep } from "@/app/lib/director/types";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import { resolveDirectorShotCount } from "@/app/lib/shot-control/resolve-director-shot-count";
import { applyDirectorPipelineToWorkbench } from "./apply-pipeline-result";
import { runBatchShotImages } from "./run-batch-images";
import {
  clearDownstreamForDirectorChange,
  isDirectorPlanStale,
  isEditGraphStale,
  shouldClearDownstream,
} from "./downstream-stale";
import type {
  AiDirectorOrchestratorStep,
  AiDirectorRunOptions,
  AiDirectorRunResult,
} from "./types";
import { DEFAULT_AI_DIRECTOR_RUN_OPTIONS } from "./types";

const DIRECTOR_STEP_LABEL: Record<DirectorPipelineStep, string> = {
  title: "生成标题",
  script: "生成脚本",
  "visual-settings": "推断视觉设定",
  storyboard: "生成分镜",
  prompts: "生成镜头 Prompt",
};

export type AiDirectorProgressCallback = (step: AiDirectorOrchestratorStep) => void;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

function mergeState(
  base: T2VWorkbenchState,
  patch: Partial<T2VWorkbenchState>
): T2VWorkbenchState {
  return { ...base, ...patch };
}

function hasGeneratedMedia(state: T2VWorkbenchState): boolean {
  if (Object.keys(state.shotFrames ?? {}).length > 0) return true;
  return Object.values(state.batchResults ?? {}).some((r) => r?.status === "success");
}

export async function runAiDirectorOrchestrator(
  state: T2VWorkbenchState,
  opts: AiDirectorRunOptions = {},
  onProgress?: AiDirectorProgressCallback,
  signal?: AbortSignal
): Promise<AiDirectorRunResult> {
  throwIfAborted(signal);
  const taskId = `ai-director-${Date.now()}`;
  const steps: AiDirectorOrchestratorStep[] = [];
  const options = { ...DEFAULT_AI_DIRECTOR_RUN_OPTIONS, ...opts };

  const push = (
    id: string,
    phase: AiDirectorOrchestratorStep["phase"],
    label: string,
    status: AiDirectorOrchestratorStep["status"],
    message: string
  ) => {
    const row: AiDirectorOrchestratorStep = {
      id,
      phase,
      label,
      status,
      message,
      at: new Date().toISOString(),
    };
    steps.push(row);
    onProgress?.(row);
  };

  const topic = state.topic?.trim();
  if (!topic) {
    push("preflight", "director", "校验", "failed", "请填写视频主题");
    return {
      taskId,
      status: "failed",
      steps,
      workbenchPatch: {},
      error: "请填写视频主题",
    };
  }

  let workbench = { ...state };
  let workbenchPatch: Partial<T2VWorkbenchState> = {};
  let directorResult;

  const directorPhaseDone =
    options.resumeFromPhases?.includes("director") && !options.directorParamsChanged;
  const pipelineMode = workbench.pipelineMode ?? "t2v";
  const directorShotCount = resolveDirectorShotCount({
    pipelineMode,
    shotCount: workbench.shotCount,
    imageBudget: workbench.imageBudget ?? 45,
  });
  const storyboardMismatch =
    pipelineMode === "t2v" &&
    Boolean(workbench.director?.storyboard?.length) &&
    workbench.director!.storyboard.length !== directorShotCount;

  const imageBudgetViolation =
    pipelineMode === "t2i" &&
    Boolean(workbench.imageTasks?.length) &&
    workbench.imageTasks!.length > (workbench.imageBudget ?? 45);

  const needDirector =
    !directorPhaseDone &&
    (options.forceRerunDirector ||
      !workbench.director?.storyboard?.length ||
      options.directorParamsChanged === true ||
      storyboardMismatch ||
      imageBudgetViolation);

  if (needDirector) {
    throwIfAborted(signal);
    push("director-start", "director", "AI 编导", "running", "开始一键编导…");
    try {
      directorResult = await runDirectorPipeline(
        {
          topic,
          shotCount: directorShotCount,
          imageBudget: workbench.imageBudget ?? 45,
          shotDurationSec: workbench.shotDurationSec,
          targetDurationMinutes: workbench.targetDurationMinutes,
          outputMode: pipelineMode === "t2i" ? "image" : "video",
          characterIds: workbench.characterIds,
          sceneIds: workbench.sceneIds,
          propIds: workbench.propIds ?? [],
          projectBible: workbench.projectBible,
          projectStyle: workbench.projectStyle,
          ...(workbench.sourceScript?.trim()
            ? {
                script: workbench.sourceScript.trim(),
                title: workbench.sourceScriptLabel?.trim() || topic,
              }
            : {}),
        },
        (step, message) => {
          push(
            `director-${step}`,
            "director",
            DIRECTOR_STEP_LABEL[step],
            "running",
            message
          );
        }
      );

      const directorPatch = applyDirectorPipelineToWorkbench(workbench, directorResult, {
        preserveGeneratedMedia:
          !options.clearGeneratedMedia &&
          (hasGeneratedMedia(workbench) || options.forceRerunDirector === false),
      });
      const downstreamReset =
        shouldClearDownstream(workbench, directorResult.storyboard)
          ? clearDownstreamForDirectorChange()
          : {};
      workbench = mergeState(workbench, { ...directorPatch, ...downstreamReset });
      workbenchPatch = { ...workbenchPatch, ...directorPatch, ...downstreamReset };
      push(
        "director-done",
        "director",
        "AI 编导",
        "done",
        `完成 · ${directorResult.storyboard.length} 镜 · ${directorResult.title}`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 编导阶段的错误此前只作为返回值进 SSE，从不落 stdout —— 补日志便于诊断
      console.error("[ai-director] 编导阶段失败:", e instanceof Error ? e.stack ?? e.message : e);
      push("director-done", "director", "AI 编导", "failed", msg);
      return {
        taskId,
        status: "failed",
        steps,
        workbenchPatch,
        directorResult,
        error: msg,
      };
    }
  } else {
    push(
      "director-skip",
      "director",
      "AI 编导",
      "skipped",
      `已有 ${workbench.director!.storyboard.length} 镜分镜，跳过（可勾选强制重跑）`
    );
  }

  let batchImages;
  const isT2i = (workbench.pipelineMode ?? "t2v") === "t2i";
  const shotTotal = workbench.director?.storyboard?.length ?? 0;
  const frameCount = Object.keys(workbench.shotFrames ?? {}).length;
  const mediaPhaseDone =
    options.resumeFromPhases?.includes("media") && !options.directorParamsChanged;
  const wantBatchImages = isT2i && (options.runBatchImages ?? true) && shotTotal > 0;
  const needMedia =
    wantBatchImages &&
    !mediaPhaseDone &&
    (options.forceRerunImages || frameCount < shotTotal);

  if (wantBatchImages && !needMedia && shotTotal > 0 && frameCount >= shotTotal) {
    push(
      "media-skip-done",
      "media",
      "批量生图",
      "skipped",
      `已有 ${frameCount} 镜画面，跳过`
    );
  } else if (!wantBatchImages) {
    push(
      "media-skip",
      "media",
      "批量生图",
      "skipped",
      !isT2i
        ? "非文生图模式，跳过"
        : options.runBatchImages === false
          ? "未启用批量生图"
          : "跳过"
    );
  }

  if (needMedia) {
    throwIfAborted(signal);
    push(
      "media-start",
      "media",
      "批量生图",
      "running",
      `开始生成 ${shotTotal} 镜画面（并发 ${3}）…`
    );
    try {
      batchImages = await runBatchShotImages(workbench, {
        forceRegenerate: options.forceRerunImages,
        signal,
        onShot: (step) => {
          push(
            `media-shot-${step.shotIndex}`,
            "media",
            `镜 ${step.shotIndex + 1}`,
            step.status === "failed" ? "failed" : "running",
            step.message
          );
        },
      });
      workbench = mergeState(workbench, batchImages.workbenchPatch);
      workbenchPatch = { ...workbenchPatch, ...batchImages.workbenchPatch };
      push(
        "media-done",
        "media",
        "批量生图",
        batchImages.failed > 0 ? "failed" : "done",
        `完成 ${batchImages.generated} 镜${batchImages.failed > 0 ? ` · ${batchImages.failed} 镜失败` : ""}`
      );
      if (batchImages.failed > 0 && batchImages.generated === 0) {
        return {
          taskId,
          status: "partial",
          steps,
          workbenchPatch,
          directorResult,
          batchImages,
          error: "全部镜头生图失败",
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      push("media-done", "media", "批量生图", "failed", msg);
      return {
        taskId,
        status: "partial",
        steps,
        workbenchPatch,
        directorResult,
        batchImages,
        error: msg,
      };
    }
  }

  let autoEdit;
  const hasEditGraph = Boolean(workbench.editGraph?.timeline?.video?.length);
  const editStale = isEditGraphStale(workbench);
  const editPhaseDone =
    options.resumeFromPhases?.includes("edit") &&
    !options.editSettingsChanged &&
    !editStale;
  const needEdit =
    !editPhaseDone &&
    options.runEditGraph !== false &&
    (options.forceRerunEdit || !hasEditGraph || editStale);

  if (needEdit) {
    throwIfAborted(signal);
    if (editStale && hasEditGraph && !options.forceRerunEdit) {
      push(
        "edit-stale",
        "edit",
        "剪辑编排",
        "running",
        `分镜 ${workbench.director!.storyboard.length} 镜，旧时间线 ${workbench.editGraph!.timeline.video.length} 镜 — 自动重编`
      );
    }
    try {
      autoEdit = await runAutoEditPipeline(workbench, (step) => {
        push(`edit-${step.id}`, "edit", step.label, step.status, step.message);
      });
      workbench = mergeState(workbench, autoEdit.workbenchPatch);
      workbenchPatch = { ...workbenchPatch, ...autoEdit.workbenchPatch };
      push("edit-done", "edit", "剪辑编排", "done", "EditGraph 已就绪");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      push("edit-done", "edit", "剪辑编排", "failed", msg);
      return {
        taskId,
        status: "partial",
        steps,
        workbenchPatch,
        directorResult,
        autoEdit,
        error: msg,
      };
    }
  } else {
    push(
      "edit-skip",
      "edit",
      "剪辑编排",
      "skipped",
      hasEditGraph
        ? `已有 EditGraph（${workbench.editGraph!.timeline.video.length} 镜），跳过`
        : "已跳过"
    );
  }

  let aiCut;
  const hasPlan = Boolean(workbench.directorPlan?.clips?.length);
  const planStale = isDirectorPlanStale(workbench);
  const planPhaseDone =
    options.resumeFromPhases?.includes("plan") &&
    !options.editSettingsChanged &&
    !planStale;
  const needPlan =
    !planPhaseDone &&
    options.runDirectorPlan !== false &&
    (options.forceRerunPlan || !hasPlan || planStale);

  if (needPlan) {
    throwIfAborted(signal);
    if (planStale && hasPlan && !options.forceRerunPlan) {
      push(
        "plan-stale",
        "plan",
        "Director Plan",
        "running",
        `分镜 ${workbench.director!.storyboard.length} 镜，旧 Plan ${workbench.directorPlan!.clips.length} 镜 — 自动重生成`
      );
    }
    try {
      aiCut = await runAiCutPipeline(workbench, (step) => {
        push(`plan-${step.id}`, "plan", step.label, step.status, step.message);
      });
      workbench = mergeState(workbench, aiCut.workbenchPatch);
      workbenchPatch = { ...workbenchPatch, ...aiCut.workbenchPatch };
      push(
        "plan-done",
        "plan",
        "Director Plan",
        "done",
        `${aiCut.directorPlan.clips.length} 镜 · ${aiCut.clipAgent.commands.length} 条命令`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      push("plan-done", "plan", "Director Plan", "failed", msg);
      const hasFailure = steps.some((s) => s.status === "failed");
      return {
        taskId,
        status: hasFailure ? "failed" : "partial",
        steps,
        workbenchPatch,
        directorResult,
        autoEdit,
        aiCut,
        error: msg,
      };
    }
  } else {
    push(
      "plan-skip",
      "plan",
      "Director Plan",
      "skipped",
      hasPlan ? `已有 Director Plan（${workbench.directorPlan!.clips.length} 镜），跳过` : "已跳过"
    );
  }

  workbenchPatch = {
    ...workbenchPatch,
    directorLoading: false,
    error: null,
  };

  if (steps.length > 0 && steps.every((s) => s.status === "skipped")) {
    push("all-ready", "director", "完成", "done", "各阶段成果已齐全，未重复执行");
  }

  return {
    taskId,
    status: "success",
    steps,
    workbenchPatch,
    directorResult,
    batchImages,
    autoEdit,
    aiCut,
  };
}
