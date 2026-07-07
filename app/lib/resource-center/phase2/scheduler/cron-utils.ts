import {
  DEFAULT_SCHEDULER_CONFIG,
  type CrawlFrequency,
  type SchedulerGlobalConfig,
  type SourceScheduleConfig,
} from "./types";

const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 } as const;

export function parseTimeHHMM(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

/** 计算下次调度时间 */
export function computeNextRunAt(
  schedule: Pick<SourceScheduleConfig, "frequency" | "customCron" | "crawlTimes">,
  from = new Date()
): Date | null {
  const times = schedule.crawlTimes.length ? schedule.crawlTimes : ["02:00"];
  const candidates: Date[] = [];

  for (const t of times) {
    const parsed = parseTimeHHMM(t);
    if (!parsed) continue;

    if (schedule.frequency === "hourly") {
      const d = new Date(from);
      d.setMinutes(parsed.m, 0, 0);
      if (d <= from) d.setHours(d.getHours() + 1);
      candidates.push(d);
      continue;
    }

    if (schedule.frequency === "custom" && schedule.customCron.trim()) {
      const next = parseSimpleCron(schedule.customCron.trim(), from);
      if (next) candidates.push(next);
      continue;
    }

    const d = new Date(from);
    d.setHours(parsed.h, parsed.m, 0, 0);

    if (schedule.frequency === "daily") {
      if (d <= from) d.setDate(d.getDate() + 1);
      candidates.push(d);
    } else if (schedule.frequency === "weekly") {
      while (d <= from || d.getDay() !== 1) {
        d.setDate(d.getDate() + 1);
        d.setHours(parsed.h, parsed.m, 0, 0);
      }
      candidates.push(d);
    } else if (schedule.frequency === "monthly") {
      d.setDate(1);
      if (d <= from) {
        d.setMonth(d.getMonth() + 1);
        d.setDate(1);
        d.setHours(parsed.h, parsed.m, 0, 0);
      }
      candidates.push(d);
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0]!;
}

/** 极简 Cron：分 时 日 月 周（仅支持 * 与数字） */
function parseSimpleCron(cron: string, from: Date): Date | null {
  const parts = cron.split(/\s+/);
  if (parts.length < 5) return null;
  const [minP, hourP] = parts;
  const d = new Date(from);
  d.setSeconds(0, 0);
  const minute = minP === "*" ? from.getMinutes() : Number(minP);
  const hour = hourP === "*" ? from.getHours() : Number(hourP);
  if (Number.isNaN(minute) || Number.isNaN(hour)) return null;
  d.setHours(hour, minute, 0, 0);
  if (d <= from) d.setDate(d.getDate() + 1);
  return d;
}

export function sortSourcesByStrategy<T extends { priority: SourceScheduleConfig["priority"] }>(
  items: T[],
  strategy: SchedulerGlobalConfig["pollingStrategy"]
): T[] {
  if (strategy === "random") {
    return [...items].sort(() => Math.random() - 0.5);
  }
  if (strategy === "sequential") return items;
  return [...items].sort(
    (a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
  );
}

export function speedLimitBytesPerSec(limit: SchedulerGlobalConfig["downloadSpeedLimit"], customMbps: number): number | null {
  switch (limit) {
    case "10mb":
      return 10 * 1024 * 1024;
    case "20mb":
      return 20 * 1024 * 1024;
    case "50mb":
      return 50 * 1024 * 1024;
    case "custom":
      return customMbps * 1024 * 1024;
    default:
      return null;
  }
}

export function cpuThreadBudget(limit: SchedulerGlobalConfig["cpuLimit"], custom: number): number {
  switch (limit) {
    case "low":
      return 1;
    case "high":
      return 4;
    case "custom":
      return Math.max(1, custom);
    default:
      return 2;
  }
}

export function mergeGlobalConfig(raw: Partial<SchedulerGlobalConfig> | null | undefined): SchedulerGlobalConfig {
  const base = structuredClone(DEFAULT_SCHEDULER_CONFIG);
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    autoCleanup: {
      ...base.autoCleanup,
      ...(raw.autoCleanup ?? {}),
    },
  };
}
