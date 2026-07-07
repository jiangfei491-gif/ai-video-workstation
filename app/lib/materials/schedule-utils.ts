import { SCHEDULE_WEEKDAYS, type ScheduleFrequency } from "./schedule-types";

export function weekdayToJs(id: number): number {
  return id === 7 ? 0 : id;
}

export function parseTimeOfDay(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function clampIntervalHours(value: number): number {
  return Math.max(1, Math.min(168, Math.floor(value) || 1));
}

export function computeNextRunAt(params: {
  frequency: ScheduleFrequency;
  timeOfDay?: string;
  weekday?: number;
  intervalHours?: number;
  from?: Date;
}): string {
  const from = params.from ?? new Date();

  if (params.frequency === "interval") {
    const hours = clampIntervalHours(params.intervalHours ?? 1);
    return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
  }

  const timeOfDay = params.timeOfDay?.trim() || "08:00";
  const parsed = parseTimeOfDay(timeOfDay);
  if (!parsed) throw new Error("时间格式无效");

  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setHours(parsed.hour, parsed.minute, 0, 0);

  if (params.frequency === "daily") {
    if (next.getTime() <= from.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  }

  const target = weekdayToJs(params.weekday ?? 1);
  const current = next.getDay();
  let daysUntil = (target - current + 7) % 7;
  if (daysUntil === 0 && next.getTime() <= from.getTime()) {
    daysUntil = 7;
  }
  next.setDate(next.getDate() + daysUntil);
  return next.toISOString();
}

export function formatScheduleWhen(
  frequency: ScheduleFrequency,
  timeOfDay: string,
  weekday?: number,
  intervalHours?: number,
  count?: number
): string {
  if (frequency === "interval") {
    const h = intervalHours ?? 1;
    const c = count ?? 1;
    return `每 ${h} 小时 · 每次 ${c} 条`;
  }
  if (frequency === "daily") return `每天 ${timeOfDay} · 每次 ${count ?? 1} 条`;
  const label =
    SCHEDULE_WEEKDAYS.find((d) => d.id === weekday)?.label ?? "周一";
  return `每${label} ${timeOfDay} · 每次 ${count ?? 1} 条`;
}

export function formatScheduleLastResult(
  result?: { found: number; created: number; skipped: number; error?: string }
): string {
  if (!result) return "尚未运行";
  if (result.error) return `失败：${result.error}`;
  return `找到 ${result.found} · 入库 ${result.created} · 跳过 ${result.skipped}`;
}

/** ISO 时间戳 → 本地时区展示（避免直接截取 UTC 字符串） */
export function formatScheduleDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
