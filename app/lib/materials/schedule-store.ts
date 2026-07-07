import { randomUUID } from "crypto";
import {
  readProductionJson,
  writeProductionJson,
} from "@/app/lib/storage/production-json";
import {
  resolveMaterialSearchCategory,
  resolveMaterialSearchLanguage,
  resolveMaterialSearchProvider,
} from "./types";
import { clampIntervalHours, computeNextRunAt } from "./schedule-utils";
import type {
  MaterialSchedule,
  MaterialScheduleResult,
  ScheduleFrequency,
} from "./schedule-types";

const SCHEDULES_FILE = "material-schedules.json";

function load(): MaterialSchedule[] {
  return readProductionJson<MaterialSchedule[]>(SCHEDULES_FILE, []).map((s) => ({
    ...s,
    searchProvider: resolveMaterialSearchProvider(s.searchProvider),
  }));
}

function save(items: MaterialSchedule[]): void {
  writeProductionJson(SCHEDULES_FILE, items);
}

function scheduleTimingFields(schedule: Pick<
  MaterialSchedule,
  "frequency" | "timeOfDay" | "weekday" | "intervalHours"
>) {
  return {
    frequency: schedule.frequency,
    timeOfDay: schedule.timeOfDay,
    weekday: schedule.weekday,
    intervalHours: schedule.intervalHours,
  };
}

export function listSchedules(): MaterialSchedule[] {
  return load().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getSchedule(id: string): MaterialSchedule | null {
  return load().find((s) => s.id === id) ?? null;
}

function defaultName(
  task: string,
  frequency: ScheduleFrequency,
  intervalHours?: number,
  count?: number
): string {
  const short = task.trim().slice(0, 16);
  const suffix = task.length > 16 ? "…" : "";
  if (frequency === "interval") {
    return `${short}${suffix} · 每${intervalHours ?? 1}小时${count ?? 1}条`;
  }
  if (frequency === "weekly") return `${short}${suffix} · 每周`;
  return `${short}${suffix} · 每日`;
}

export function createSchedule(params: {
  name?: string;
  task: string;
  count?: number;
  category?: string;
  language?: string;
  searchProvider?: string;
  autoAnalyze?: boolean;
  frequency?: ScheduleFrequency;
  timeOfDay?: string;
  weekday?: number;
  intervalHours?: number;
  enabled?: boolean;
}): MaterialSchedule {
  const task = params.task.trim();
  if (!task) throw new Error("请填写任务描述");

  const frequency = params.frequency ?? "daily";
  const count = Math.max(1, Math.min(20, Math.floor(params.count ?? 5)));
  const timeOfDay = params.timeOfDay?.trim() || "08:00";
  const weekday = frequency === "weekly" ? (params.weekday ?? 1) : undefined;
  const intervalHours =
    frequency === "interval" ? clampIntervalHours(params.intervalHours ?? 1) : undefined;
  const enabled = params.enabled ?? true;

  const schedule: MaterialSchedule = {
    id: randomUUID(),
    name:
      params.name?.trim() ||
      defaultName(task, frequency, intervalHours, count),
    enabled,
    task,
    count,
    category: resolveMaterialSearchCategory(params.category),
    language: resolveMaterialSearchLanguage(params.language),
    searchProvider: resolveMaterialSearchProvider(params.searchProvider),
    autoAnalyze: params.autoAnalyze ?? true,
    frequency,
    timeOfDay,
    weekday,
    intervalHours,
    nextRunAt: computeNextRunAt({
      frequency,
      timeOfDay,
      weekday,
      intervalHours,
    }),
    createdAt: new Date().toISOString(),
  };

  const all = load();
  all.push(schedule);
  save(all);
  return schedule;
}

export function updateSchedule(
  id: string,
  patch: Partial<
    Pick<
      MaterialSchedule,
      | "name"
      | "enabled"
      | "task"
      | "count"
      | "category"
      | "searchProvider"
      | "autoAnalyze"
      | "frequency"
      | "timeOfDay"
      | "weekday"
      | "intervalHours"
    >
  > & { language?: string }
): MaterialSchedule {
  const all = load();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("定时任务不存在");

  const prev = all[idx];
  const { language: patchLanguage, searchProvider: patchSearchProvider, ...restPatch } =
    patch;
  const nextFrequency = patch.frequency ?? prev.frequency;
  const next: MaterialSchedule = {
    ...prev,
    ...restPatch,
    ...(patch.task !== undefined ? { task: patch.task.trim() } : {}),
    ...(patch.name !== undefined ? { name: patch.name.trim() || prev.name } : {}),
    ...(patch.count !== undefined
      ? { count: Math.max(1, Math.min(20, Math.floor(patch.count))) }
      : {}),
    ...(patch.category !== undefined
      ? { category: patch.category.trim() || prev.category }
      : {}),
    ...(patchLanguage !== undefined
      ? { language: resolveMaterialSearchLanguage(patchLanguage) }
      : {}),
    ...(patchSearchProvider !== undefined
      ? { searchProvider: resolveMaterialSearchProvider(patchSearchProvider) }
      : {}),
    ...(patch.intervalHours !== undefined
      ? { intervalHours: clampIntervalHours(patch.intervalHours) }
      : {}),
  };

  if (nextFrequency === "daily") {
    next.weekday = undefined;
    next.intervalHours = undefined;
  } else if (nextFrequency === "weekly") {
    next.intervalHours = undefined;
    if (next.weekday === undefined) next.weekday = prev.weekday ?? 1;
  } else if (nextFrequency === "interval") {
    next.weekday = undefined;
    if (next.intervalHours === undefined) {
      next.intervalHours = prev.intervalHours ?? 1;
    }
  }
  next.frequency = nextFrequency;

  const scheduleChanged =
    patch.frequency !== undefined ||
    patch.timeOfDay !== undefined ||
    patch.weekday !== undefined ||
    patch.intervalHours !== undefined ||
    patch.enabled === true;

  if (scheduleChanged || patch.enabled !== undefined) {
    next.nextRunAt = computeNextRunAt(scheduleTimingFields(next));
  }

  all[idx] = next;
  save(all);
  return next;
}

export function recordScheduleRun(
  id: string,
  result: MaterialScheduleResult
): MaterialSchedule {
  const all = load();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("定时任务不存在");

  const prev = all[idx];
  const now = new Date();
  const updated: MaterialSchedule = {
    ...prev,
    lastRunAt: now.toISOString(),
    lastResult: result,
    nextRunAt: computeNextRunAt({
      ...scheduleTimingFields(prev),
      from: now,
    }),
  };

  all[idx] = updated;
  save(all);
  return updated;
}

export function deleteSchedule(id: string): boolean {
  const all = load();
  const next = all.filter((s) => s.id !== id);
  if (next.length === all.length) return false;
  save(next);
  return true;
}

export function listDueSchedules(now = new Date()): MaterialSchedule[] {
  const ts = now.getTime();
  return load().filter((s) => s.enabled && new Date(s.nextRunAt).getTime() <= ts);
}
