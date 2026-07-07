import { generateNarrativeStoryboard } from "@/app/lib/narrative";
import { generateProviderPrompts } from "./generate-provider-prompts";
import { generateScript } from "./generate-script";
import { generateStoryboard } from "./generate-storyboard";
import { generateTitle } from "./generate-title";
import { inferVisualSettings } from "./infer-visual-settings";
import { inferShotConsistencyMeta } from "@/app/lib/consistency-engine";
import { emptyTokenLine, mergeTokenLine } from "@/app/lib/cost-ledger/merge";
import type { DirectorCostDetail } from "@/app/lib/cost-ledger/types";
import { recordTokenCost, guessProvider } from "@/app/lib/cost-ledger/unified";
import {
  attachProviderPromptsToTasks,
  planImageBudget,
  resolveProviderPromptForImageTask,
} from "@/app/lib/image-task";
import type { ImageTask } from "@/app/lib/image-task/types";
import { assertImageBudgetCompliance } from "@/app/lib/image-task/validate-budget";
import { planNarrativeDuration } from "./duration/plan-narrative-duration";
import { buildNarrationAssignment } from "./narration/build-narration-assignment";
import type {
  DirectorPipelineInput,
  DirectorPipelineResult,
  DirectorProgressCallback,
} from "./types";

const DEFAULT_SHOT_COUNT = 5;

export async function runDirectorPipeline(
  input: DirectorPipelineInput,
  onProgress?: DirectorProgressCallback
): Promise<DirectorPipelineResult> {
  const topic = input.topic.trim();
  if (!topic) throw new Error("请输入视频主题");

  let title: string;
  let script: string;
  let scriptCost = emptyTokenLine();

  if (input.script?.trim()) {
    title = input.title?.trim() || input.topic.trim();
    script = input.script.trim();
    scriptCost = { model: "已跳过（导入脚本）", inputTokens: 0, outputTokens: 0, costUsd: 0 };
    onProgress?.("script", "使用素材库脚本，跳过 AI 写脚本…");
  } else {
    onProgress?.("title", "正在生成标题…");
    const titleResult = await generateTitle(topic);
    title = titleResult.title;
    scriptCost = mergeTokenLine(scriptCost, titleResult.usage);

    onProgress?.("script", "正在生成脚本…");
    const scriptResult = await generateScript(topic, title);
    script = scriptResult.script;
    scriptCost = mergeTokenLine(scriptCost, scriptResult.usage);
  }

  onProgress?.("visual-settings", "正在推断项目圣经 / 风格 / 世界观…");
  const visualResult = await inferVisualSettings({ topic, title, script });
  const visualSettings = visualResult.settings;
  scriptCost = mergeTokenLine(scriptCost, visualResult.usage);

  const effectiveProjectBible = {
    videoType: input.projectBible?.videoType || visualSettings.projectBible.videoType,
    colorTone: input.projectBible?.colorTone || visualSettings.projectBible.colorTone,
    cameraLanguage:
      input.projectBible?.cameraLanguage || visualSettings.projectBible.cameraLanguage,
    lightingRules:
      input.projectBible?.lightingRules || visualSettings.projectBible.lightingRules,
    forbidden: input.projectBible?.forbidden || visualSettings.projectBible.forbidden,
  };
  const effectiveProjectStyle =
    input.projectStyle?.trim() || visualSettings.projectStyle;

  const outputMode = input.outputMode ?? "video";
  let storyboard;
  let storyboardUsage = emptyTokenLine();
  let narrativeBeats;
  let imageTasks;
  let imageTaskMapping;
  let imageBudgetPlannerMode: "gpt" | "rule-fallback" | undefined;
  let plannerUsage = emptyTokenLine();

  if (outputMode === "image") {
    onProgress?.("storyboard", "正在分析 Narrative Beat 并自然拆镜…");
    const narrativeResult = await generateNarrativeStoryboard(title, script, {
      targetDurationMinutes: input.targetDurationMinutes,
      shotDurationSec: input.shotDurationSec,
    });
    storyboard = narrativeResult.storyboard;
    narrativeBeats = narrativeResult.beats;
    storyboardUsage = narrativeResult.usage;

    // NarrationAssignment (Closure)：Beat 旁白 → 该 Beat 镜头（beat-aware, shotId）。
    // 写回 storyboard.narration，成为 Planner / TTS / Subtitle 的共同 assignment truth（不再各自分句）。
    const narrationAssignment = buildNarrationAssignment({ beats: narrativeBeats, storyboard });
    storyboard = storyboard.map((sb) =>
      sb.shotId ? { ...sb, narration: narrationAssignment.shotNarrationText[sb.shotId] ?? "" } : sb
    );

    // Duration Planner：targetDuration → Beat 权重(旁白估时) → 每镜 narration-aware 分配。
    // 无显式目标时用旧总时长(镜数×shotDurationSec)兜底，但仍按权重分配。
    const targetDurationSec =
      input.targetDurationMinutes && input.targetDurationMinutes > 0
        ? input.targetDurationMinutes * 60
        : storyboard.length * (input.shotDurationSec || 6);
    const durationPlan = planNarrativeDuration({
      targetDurationSec,
      beats: narrativeBeats,
      storyboard,
    });
    storyboard = storyboard.map((sb) =>
      sb.shotId && durationPlan.shotDurations[sb.shotId] != null
        ? { ...sb, duration: durationPlan.shotDurations[sb.shotId] }
        : sb
    );

    const imageBudget = Math.max(1, input.imageBudget ?? 45);
    onProgress?.("storyboard", `Image Budget Planner（预算 ${imageBudget}）…`);
    const planResult = await planImageBudget({
      title,
      beats: narrativeBeats,
      storyboard,
      imageBudget,
    });
    imageTasks = attachProviderPromptsToTasks(planResult.imageTasks, storyboard, []);
    imageTaskMapping = planResult.mapping;
    imageBudgetPlannerMode = planResult.plannerMode;
    plannerUsage = planResult.usage;
    assertImageBudgetCompliance(imageTasks, imageBudget);
  } else {
    onProgress?.("storyboard", "正在生成导演分镜…");
    const legacyShotCount = Math.max(1, input.shotCount ?? DEFAULT_SHOT_COUNT);
    const storyboardResult = await generateStoryboard(title, script, legacyShotCount, {
      shotDurationSec: input.shotDurationSec,
      outputMode,
    });
    storyboard = storyboardResult.storyboard;
    storyboardUsage = storyboardResult.usage;
  }

  onProgress?.("prompts", outputMode === "image" ? "正在生成 ImageTask Prompt…" : "正在生成 Veo Prompt…");
  const promptsResult = await generateProviderPrompts(title, storyboard, outputMode, {
    characterIds: input.characterIds,
    sceneIds: input.sceneIds,
    propIds: input.propIds,
    projectBible: effectiveProjectBible,
    projectStyle: effectiveProjectStyle,
  });
  let prompts = promptsResult.prompts;

  if (outputMode === "image" && imageTasks && imageTaskMapping) {
    imageTasks = attachProviderPromptsToTasks(imageTasks, storyboard, prompts);
    imageTasks = imageTasks.map((task) => ({
      ...task,
      providerPrompt: resolveProviderPromptForImageTask(task, {
        storyboard,
        projectStyle: effectiveProjectStyle,
      }),
    }));
    prompts = storyboard.map((sb, i) => {
      const shotId = sb.shotId ?? `SHOT_${String(i + 1).padStart(3, "0")}`;
      const taskId = imageTaskMapping.shotToImageTaskMap[shotId];
      const task = imageTasks!.find((t: ImageTask) => t.imageTaskId === taskId);
      return {
        sceneNumber: sb.sceneNumber,
        providerPrompt: task
          ? resolveProviderPromptForImageTask(task, {
              storyboard,
              projectStyle: effectiveProjectStyle,
            })
          : prompts[i]?.providerPrompt ?? "",
      };
    });
  }

  const shotConsistency =
    (input.characterIds?.length ?? 0) > 0 ||
    (input.sceneIds?.length ?? 0) > 0 ||
    (input.propIds?.length ?? 0) > 0
      ? inferShotConsistencyMeta(
          storyboard,
          input.characterIds ?? [],
          input.sceneIds ?? [],
          input.propIds ?? []
        )
      : undefined;

  const costDetail: DirectorCostDetail = {
    script: scriptCost,
    storyboard: mergeTokenLine(storyboardUsage, plannerUsage),
    prompts: promptsResult.usage,
  };

  for (const [op, line] of [
    ["脚本", scriptCost],
    ["分镜", mergeTokenLine(storyboardUsage, plannerUsage)],
    ["镜头 Prompt", promptsResult.usage],
  ] as const) {
    if (line && (line.inputTokens > 0 || line.outputTokens > 0)) {
      recordTokenCost("AI导演", op, guessProvider(line.model), line.model, line.inputTokens, line.outputTokens, {
        costUsd: line.costUsd,
      });
    }
  }

  return {
    title,
    script,
    storyboard,
    prompts,
    shotConsistency,
    visualSettings,
    costDetail,
    ...(outputMode === "image"
      ? {
          narrativeBeats,
          imageTasks,
          imageTaskMapping,
          imageBudgetPlannerMode,
        }
      : {}),
  };
}
