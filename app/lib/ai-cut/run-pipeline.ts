import {
  buildEditInputFromWorkbench,
  pacingFromStyle,
} from "@/app/lib/auto-edit";
import { refreshEditGraphFromWorkbench } from "@/app/lib/auto-edit/edit-graph";
import { generateDirectorPlan } from "@/app/lib/director-plan";
import { editGraphToDirectorPlan } from "@/app/lib/director-plan/adapters";
import type { DirectorPlan } from "@/app/lib/director-plan/types";
import { recordTokenCost, guessProvider } from "@/app/lib/cost-ledger/unified";
import { runClipAgent } from "@/app/lib/clip-agent";
import type { ClipAgentResult } from "@/app/lib/clip-agent/types";
import type { OpenCutProjectPayload } from "@/app/lib/opencut/project-bridge";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import { currentStoryboardFingerprint } from "@/app/lib/ai-director/downstream-stale";

export type AiCutStepId =
  | "director-plan"
  | "material-agent"
  | "voice-agent"
  | "subtitle-agent"
  | "clip-agent"
  | "opencut-engine";

export type AiCutStepResult = {
  id: AiCutStepId;
  label: string;
  status: "done" | "skipped" | "failed";
  message: string;
};

export type AiCutPipelineResult = {
  steps: AiCutStepResult[];
  directorPlan: DirectorPlan;
  clipAgent: ClipAgentResult;
  openCutProject: OpenCutProjectPayload;
  workbenchPatch: Partial<T2VWorkbenchState>;
};

const STEP_LABELS: Record<AiCutStepId, string> = {
  "director-plan": "AI 导演生成方案",
  "material-agent": "素材 Agent 对齐",
  "voice-agent": "配音 Agent",
  "subtitle-agent": "字幕 Agent",
  "clip-agent": "剪辑 Agent 翻译命令",
  "opencut-engine": "OpenCut 执行引擎",
};

/**
 * AI Cut 新编排 — 大脑与双手分离
 *
 * AI 导演 → Director Plan
 * 素材/配音/字幕 Agent →  enrich plan
 * 剪辑 Agent → OpenCut 命令
 * OpenCut → 执行（时间线 / 轨道 / 特效 / 导出）
 */
export async function runAiCutPipeline(
  state: T2VWorkbenchState,
  onStep?: (step: AiCutStepResult) => void
): Promise<AiCutPipelineResult> {
  const steps: AiCutStepResult[] = [];
  const push = (id: AiCutStepId, status: AiCutStepResult["status"], message: string) => {
    const row: AiCutStepResult = { id, label: STEP_LABELS[id], status, message };
    steps.push(row);
    onStep?.(row);
  };

  const input = buildEditInputFromWorkbench(state);
  if (!input) {
    push("director-plan", "failed", "请先完成 AI 编导与分镜");
    throw new Error("请先完成 AI 编导与分镜");
  }

  const pacing = pacingFromStyle(state);
  const title = state.director?.title ?? state.topic ?? "未命名项目";

  push("material-agent", "done", "同步工作台素材到媒体池");
  const graph = refreshEditGraphFromWorkbench(state);

  let directorPlan: DirectorPlan;
  if (graph) {
    // 单一真相源：已有 EditGraph（剪辑阶段已跑）→ 直接从时间线推导方案，
    // 不再第二次问 GPT。镜序/镜长/转场与 AI 剪辑页永远一致，且省一次 GPT。
    directorPlan = editGraphToDirectorPlan(graph, title);
    push("director-plan", "done", `从时间线推导 ${directorPlan.clips.length} 镜（复用旧线，省一次 GPT）`);
  } else {
    // 没有 EditGraph（跳过剪辑）才独立用 GPT 生成方案
    try {
      directorPlan = await generateDirectorPlan(input, title, pacing);
      push("director-plan", "done", `${directorPlan.clips.length} 镜 · ${directorPlan.pacingProfile}`);
      if (directorPlan.meta?.usage) {
        const u = directorPlan.meta.usage;
        recordTokenCost("AI导演", "Director Plan", guessProvider(u.model), u.model, u.inputTokens, u.outputTokens, {
          costUsd: u.costUsd,
        });
      }
    } catch (err) {
      push("director-plan", "failed", err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  push("voice-agent", directorPlan.voice ? "done" : "skipped", directorPlan.voice ? "配音轨已纳入方案" : "暂无配音");
  push("subtitle-agent", directorPlan.subtitles.length ? "done" : "skipped", `${directorPlan.subtitles.length} 条字幕`);

  let clipAgent: ClipAgentResult;
  try {
    clipAgent = await runClipAgent(directorPlan, { projectName: title });
    push("clip-agent", "done", `${clipAgent.commands.length} 条 OpenCut 命令`);
    push("opencut-engine", clipAgent.traces.some((t) => t.status === "failed") ? "failed" : "done", "工程快照已生成");
  } catch (err) {
    push("clip-agent", "failed", err instanceof Error ? err.message : String(err));
    throw err;
  }

  const storyboardFingerprint = currentStoryboardFingerprint(state);
  directorPlan = {
    ...directorPlan,
    meta: { ...directorPlan.meta, storyboardFingerprint },
  };

  return {
    steps,
    directorPlan,
    clipAgent,
    openCutProject: clipAgent.projectSnapshot,
    workbenchPatch: {
      editGraph: graph ?? state.editGraph,
      directorPlan,
      openCutCommands: clipAgent.commands,
    },
  };
}
