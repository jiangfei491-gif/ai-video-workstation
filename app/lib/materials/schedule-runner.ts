import { listMaterialSearchProviders } from "./material-search-providers";
import { runMaterialAgentJob } from "./run-agent-job";
import {
  getSchedule,
  listDueSchedules,
  recordScheduleRun,
} from "./schedule-store";

const TICK_MS = 60_000;
const g = globalThis as { __materialScheduleRunnerStarted?: boolean };
const runningIds = new Set<string>();

async function runScheduleById(id: string, manual = false): Promise<void> {
  if (runningIds.has(id)) return;
  runningIds.add(id);

  const schedule = getSchedule(id);
  if (!schedule) {
    runningIds.delete(id);
    return;
  }
  if (!manual && !schedule.enabled) {
    runningIds.delete(id);
    return;
  }
  if (listMaterialSearchProviders().length === 0) {
    recordScheduleRun(id, {
      found: 0,
      created: 0,
      skipped: 0,
      error: "未配置找素材模型（需要 OPENAI_API_KEY 或 VEO_API_KEY）",
    });
    runningIds.delete(id);
    return;
  }

  try {
    const result = await runMaterialAgentJob({
      task: schedule.task,
      count: schedule.count,
      category: schedule.category,
      language: schedule.language,
      searchProvider: schedule.searchProvider ?? "all",
      autoAnalyze: schedule.autoAnalyze,
    });
    recordScheduleRun(id, result);
  } catch (err) {
    recordScheduleRun(id, {
      found: 0,
      created: 0,
      skipped: 0,
      error: err instanceof Error ? err.message : "Agent 运行失败",
    });
  } finally {
    runningIds.delete(id);
  }
}

async function tickSchedules(): Promise<void> {
  const due = listDueSchedules();
  for (const schedule of due) {
    await runScheduleById(schedule.id);
  }
}

export function ensureMaterialScheduleRunner(): void {
  if (g.__materialScheduleRunnerStarted) return;
  g.__materialScheduleRunnerStarted = true;

  setTimeout(() => void tickSchedules(), 8_000);
  setInterval(() => void tickSchedules(), TICK_MS);
}

export async function runMaterialScheduleNow(id: string): Promise<void> {
  ensureMaterialScheduleRunner();
  await runScheduleById(id, true);
}

export function isMaterialScheduleRunning(id: string): boolean {
  return runningIds.has(id);
}
