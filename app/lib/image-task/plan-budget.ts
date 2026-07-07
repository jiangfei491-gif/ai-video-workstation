import { directorChatCompletion } from "@/app/lib/director/director-chat";
import type { DirectorStoryboardShot } from "@/app/lib/director/types";
import type { NarrativeBeat } from "@/app/lib/narrative/types";
import { emptyTokenLine, mergeTokenLine } from "@/app/lib/cost-ledger/merge";
import type { TokenCostLine } from "@/app/lib/cost-ledger/types";
import { imageTaskIdFromIndex, shotIndexFromShotId } from "./shot-id";
import type { ImageTask, ImageTaskMapping, ImageTaskPriority } from "./types";
import { assertImageBudgetCompliance } from "./validate-budget";

export type ImageBudgetPlanAssignment = {
  imageTaskId: string;
  primaryShotId: string;
  supportingShotIds: string[];
  priority: ImageTaskPriority;
  budgetReason: string;
};

export type ImageBudgetPlanResult = {
  imageTasks: ImageTask[];
  mapping: ImageTaskMapping;
  assignments: ImageBudgetPlanAssignment[];
  plannerMode: "gpt" | "rule-fallback";
  usage: TokenCostLine;
};

const CRITICAL_KEYWORDS =
  /揭示|特写|高潮|异常|震惊|首次|第一次|关键|转折|发现|秘密|冲突|对决|反转|细节|close.?up|detail|reveal|climax/i;

function isCriticalShot(shot: DirectorStoryboardShot): boolean {
  const blob = [
    shot.shotPurpose,
    shot.visualFocus,
    shot.action,
    shot.reaction,
    shot.camera,
  ]
    .filter(Boolean)
    .join(" ");
  return CRITICAL_KEYWORDS.test(blob);
}

function shotById(
  storyboard: DirectorStoryboardShot[]
): Map<string, { shot: DirectorStoryboardShot; index: number }> {
  const map = new Map<string, { shot: DirectorStoryboardShot; index: number }>();
  storyboard.forEach((shot, index) => {
    const id = shot.shotId ?? `SHOT_${String(index + 1).padStart(3, "0")}`;
    map.set(id, { shot: { ...shot, shotId: id }, index });
  });
  return map;
}

function buildTaskFromAssignment(
  assignment: ImageBudgetPlanAssignment,
  storyboard: DirectorStoryboardShot[],
  lookup: Map<string, { shot: DirectorStoryboardShot; index: number }>
): ImageTask {
  const primary = lookup.get(assignment.primaryShotId);
  if (!primary) throw new Error(`未知 primaryShotId: ${assignment.primaryShotId}`);

  const supporting = assignment.supportingShotIds
    .map((id) => lookup.get(id))
    .filter(Boolean) as { shot: DirectorStoryboardShot; index: number }[];

  const all = [primary, ...supporting];
  const actionCoverage = all.map((s) => s.shot.action).filter(Boolean);
  const visualFocus = all
    .map((s) => s.shot.visualFocus || s.shot.action?.slice(0, 24) || "character")
    .filter(Boolean);

  return {
    imageTaskId: assignment.imageTaskId,
    primaryShotId: assignment.primaryShotId,
    supportingShotIds: assignment.supportingShotIds,
    sourceShotIndexes: all.map((s) => s.index),
    character: primary.shot.character,
    actionCoverage,
    environment: primary.shot.environment,
    cameraIntent: primary.shot.camera,
    visualFocus,
    priority: assignment.priority,
    budgetReason: assignment.budgetReason,
  };
}

function validateAssignments(
  assignments: ImageBudgetPlanAssignment[],
  storyboard: DirectorStoryboardShot[],
  imageBudget: number
): void {
  const allShotIds = new Set(
    storyboard.map((s, i) => s.shotId ?? `SHOT_${String(i + 1).padStart(3, "0")}`)
  );
  const mapped = new Set<string>();

  for (const a of assignments) {
    if (!allShotIds.has(a.primaryShotId)) {
      throw new Error(`Planner 输出无效 primaryShotId: ${a.primaryShotId}`);
    }
    mapped.add(a.primaryShotId);
    for (const sid of a.supportingShotIds) {
      if (!allShotIds.has(sid)) throw new Error(`Planner 输出无效 supportingShotId: ${sid}`);
      mapped.add(sid);
    }
  }

  for (const id of allShotIds) {
    if (!mapped.has(id)) {
      throw new Error(`Planner 未映射 Shot: ${id}（禁止为 unmapped Shot 创建额外 generation unit）`);
    }
  }

  if (assignments.length > imageBudget) {
    throw new Error(`Planner 输出 ${assignments.length} 个 ImageTask，超过 imageBudget ${imageBudget}`);
  }
}

function assignmentsToResult(
  assignments: ImageBudgetPlanAssignment[],
  storyboard: DirectorStoryboardShot[],
  plannerMode: "gpt" | "rule-fallback",
  usage: TokenCostLine
): ImageBudgetPlanResult {
  const lookup = shotById(storyboard);
  const imageTasks = assignments.map((a) => buildTaskFromAssignment(a, storyboard, lookup));

  const shotToImageTaskMap: Record<string, string> = {};
  const imageTaskToShotIds: Record<string, string[]> = {};

  for (const task of imageTasks) {
    imageTaskToShotIds[task.imageTaskId] = [task.primaryShotId, ...task.supportingShotIds];
    shotToImageTaskMap[task.primaryShotId] = task.imageTaskId;
    for (const sid of task.supportingShotIds) {
      shotToImageTaskMap[sid] = task.imageTaskId;
    }
  }

  return {
    imageTasks,
    mapping: { shotToImageTaskMap, imageTaskToShotIds },
    assignments,
    plannerMode,
    usage,
  };
}

/** 规则 fallback：合并连续镜头，critical 优先独立，必须满足 imageBudget */
export function ruleFallbackImageBudgetPlan(params: {
  storyboard: DirectorStoryboardShot[];
  imageBudget: number;
}): ImageBudgetPlanAssignment[] {
  const { storyboard, imageBudget } = params;
  if (!storyboard.length) return [];

  const shots = storyboard.map((s, i) => ({
    ...s,
    shotId: s.shotId ?? `SHOT_${String(i + 1).padStart(3, "0")}`,
    index: i,
  }));

  type DraftTask = {
    primaryShotId: string;
    supportingShotIds: string[];
    priority: ImageTaskPriority;
    env: string;
    character: string;
    beatId: string;
  };

  const maxPerTask = Math.max(1, Math.ceil(shots.length / imageBudget));
  const drafts: DraftTask[] = [];
  let current: DraftTask | undefined;
  let seenEnvironments = new Set<string>();
  let seenCharacters = new Set<string>();

  const startNew = (shot: (typeof shots)[0]) => {
    current = {
      primaryShotId: shot.shotId,
      supportingShotIds: [],
      priority: isCriticalShot(shot) ? "critical" : "normal",
      env: shot.environment,
      character: shot.character,
      beatId: shot.beatId ?? "",
    };
    drafts.push(current);
  };

  for (const shot of shots) {
    const critical = isCriticalShot(shot);
    const newEnv = !seenEnvironments.has(shot.environment);
    const newChar = !seenCharacters.has(shot.character);
    seenEnvironments.add(shot.environment);
    seenCharacters.add(shot.character);

    const needNew =
      !current ||
      critical ||
      (newEnv && drafts.length < imageBudget) ||
      (newChar && drafts.length < imageBudget) ||
      (current &&
        (current.env !== shot.environment ||
          current.character !== shot.character ||
          current.supportingShotIds.length + 1 >= maxPerTask));

    if (needNew && drafts.length < imageBudget) {
      startNew(shot);
    } else if (current) {
      current.supportingShotIds.push(shot.shotId);
      if (critical) current.priority = "critical";
    } else {
      startNew(shot);
    }
  }

  while (drafts.length > imageBudget) {
    let merged = false;
    for (let i = 0; i < drafts.length - 1; i++) {
      const a = drafts[i]!;
      const b = drafts[i + 1]!;
      if (a.priority !== "critical" && b.priority !== "critical") {
        a.supportingShotIds.push(b.primaryShotId, ...b.supportingShotIds);
        drafts.splice(i + 1, 1);
        merged = true;
        break;
      }
    }
    if (!merged) {
      const last = drafts.pop()!;
      const prev = drafts[drafts.length - 1]!;
      prev.supportingShotIds.push(last.primaryShotId, ...last.supportingShotIds);
      if (last.priority === "critical") prev.priority = "critical";
    }
  }

  return drafts.map((d, i) => ({
    imageTaskId: imageTaskIdFromIndex(i),
    primaryShotId: d.primaryShotId,
    supportingShotIds: d.supportingShotIds,
    priority: d.priority,
    budgetReason: `rule-fallback:${d.priority === "critical" ? "critical-shot" : "merge-continuity"}`,
  }));
}

async function gptImageBudgetPlan(params: {
  title: string;
  beats: NarrativeBeat[];
  storyboard: DirectorStoryboardShot[];
  imageBudget: number;
}): Promise<{ assignments: ImageBudgetPlanAssignment[]; usage: TokenCostLine }> {
  const compactShots = params.storyboard.map((s, i) => ({
    shotId: s.shotId ?? `SHOT_${String(i + 1).padStart(3, "0")}`,
    beatId: s.beatId,
    character: s.character,
    action: s.action,
    visualFocus: s.visualFocus,
    shotPurpose: s.shotPurpose,
    environment: s.environment,
    camera: s.camera,
  }));

  const beatSummary = params.beats
    .slice(0, 20)
    .map((b) => `${b.beatId}: ${b.narrativePurpose} / ${b.environment}`)
    .join("\n");

  const system = `你是 Image Budget Planner。将 Narrative Shots 分配到最多 ${params.imageBudget} 个 ImageTask。

硬约束：
- tasks 数量 <= ${params.imageBudget}
- 每个 Shot 必须恰好映射到一个 ImageTask（primary 或 supporting）
- 禁止增加 imageBudget
- 禁止为 unmapped Shot 创建额外任务

分配原则：
- 独立 ImageTask：新场景/新人物首次、关键揭示、物品特写、强反应、高潮、时间/视觉状态明显变化
- 共用 ImageTask：同人物同场景、连续动作阶段、相近视觉焦点、相同光线

每个 task：
- imageTaskId: IMAGE_TASK_001 递增
- primaryShotId: 最能代表该画面的 Shot
- supportingShotIds: 其他共用 Shot（不含 primary）
- priority: critical | normal | support
- budgetReason: 简短中文原因

只返回 JSON：{ "tasks": [ ... ] }`;

  const { text, usage } = await directorChatCompletion(
    "image-budget-planner",
    system,
    `标题：${params.title}\n\nBeat 摘要：\n${beatSummary}\n\nNarrative Shots（${compactShots.length}）：\n${JSON.stringify(compactShots.slice(0, 120))}`,
    { json: true, maxTokens: 8192 }
  );

  const parsed = JSON.parse(text) as {
    tasks?: {
      imageTaskId?: string;
      primaryShotId?: string;
      supportingShotIds?: string[];
      priority?: string;
      budgetReason?: string;
    }[];
  };

  const assignments: ImageBudgetPlanAssignment[] = (parsed.tasks ?? []).map((t, i) => ({
    imageTaskId: String(t.imageTaskId ?? imageTaskIdFromIndex(i)),
    primaryShotId: String(t.primaryShotId ?? ""),
    supportingShotIds: Array.isArray(t.supportingShotIds)
      ? t.supportingShotIds.map(String)
      : [],
    priority: (["critical", "normal", "support"].includes(String(t.priority))
      ? t.priority
      : "normal") as ImageTaskPriority,
    budgetReason: String(t.budgetReason ?? "gpt-planner"),
  }));

  return { assignments, usage };
}

export async function planImageBudget(params: {
  title: string;
  beats: NarrativeBeat[];
  storyboard: DirectorStoryboardShot[];
  imageBudget: number;
  /** 跳过 GPT，仅用规则 fallback（测试/离线） */
  ruleOnly?: boolean;
}): Promise<ImageBudgetPlanResult> {
  const budget = Math.max(1, params.imageBudget);
  let usage = emptyTokenLine();

  if (params.storyboard.length <= budget) {
    const assignments: ImageBudgetPlanAssignment[] = params.storyboard.map((s, i) => ({
      imageTaskId: imageTaskIdFromIndex(i),
      primaryShotId: s.shotId ?? `SHOT_${String(i + 1).padStart(3, "0")}`,
      supportingShotIds: [],
      priority: isCriticalShot(s) ? "critical" : "normal",
      budgetReason: "under-budget-1:1",
    }));
    const result = assignmentsToResult(assignments, params.storyboard, "rule-fallback", usage);
    assertImageBudgetCompliance(result.imageTasks, budget);
    return result;
  }

  if (!params.ruleOnly) {
    try {
      const gpt = await gptImageBudgetPlan(params);
      validateAssignments(gpt.assignments, params.storyboard, budget);
      usage = mergeTokenLine(usage, gpt.usage);
      const result = assignmentsToResult(gpt.assignments, params.storyboard, "gpt", usage);
      assertImageBudgetCompliance(result.imageTasks, budget);
      return result;
    } catch {
      /* fallback below */
    }
  }

  const fallback = ruleFallbackImageBudgetPlan({
    storyboard: params.storyboard,
    imageBudget: budget,
  });

  validateAssignments(fallback, params.storyboard, budget);
  const result = assignmentsToResult(fallback, params.storyboard, "rule-fallback", usage);
  assertImageBudgetCompliance(result.imageTasks, budget);
  return result;
}

/** 将 per-shot providerPrompt 写入 ImageTask（primary 优先） */
export function attachProviderPromptsToTasks(
  imageTasks: ImageTask[],
  storyboard: DirectorStoryboardShot[],
  prompts: { providerPrompt: string }[]
): ImageTask[] {
  return imageTasks.map((task) => {
    const primaryIdx = shotIndexFromShotId(task.primaryShotId) ?? task.sourceShotIndexes[0] ?? 0;
    const providerPrompt = prompts[primaryIdx]?.providerPrompt?.trim() ?? "";
    return { ...task, providerPrompt };
  });
}
