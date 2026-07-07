import type { MaterialSearchLanguage, MaterialSearchProviderChoice } from "./types";

export type ScheduleFrequency = "daily" | "weekly" | "interval";

export type MaterialScheduleResult = {
  found: number;
  created: number;
  skipped: number;
  error?: string;
};

export type MaterialSchedule = {
  id: string;
  name: string;
  enabled: boolean;
  task: string;
  count: number;
  category: string;
  language: MaterialSearchLanguage;
  /** 搜索模型：全部=自动兜底，或指定 GPT/Gemini */
  searchProvider: MaterialSearchProviderChoice;
  autoAnalyze: boolean;
  frequency: ScheduleFrequency;
  /** 本地时间 HH:MM */
  timeOfDay: string;
  /** weekly 时：1=周一 … 7=周日 */
  weekday?: number;
  /** interval 时：每隔多少小时运行一次 */
  intervalHours?: number;
  lastRunAt?: string;
  lastResult?: MaterialScheduleResult;
  nextRunAt: string;
  createdAt: string;
};

export const SCHEDULE_WEEKDAYS = [
  { id: 1, label: "周一" },
  { id: 2, label: "周二" },
  { id: 3, label: "周三" },
  { id: 4, label: "周四" },
  { id: 5, label: "周五" },
  { id: 6, label: "周六" },
  { id: 7, label: "周日" },
] as const;
