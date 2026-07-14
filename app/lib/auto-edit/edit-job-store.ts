import {
  readProductionJson,
  writeProductionJson,
} from "@/app/lib/storage/production-json";
import type { EditRenderJob } from "./types";

const FILE = "auto-edit-jobs.json";

function load(): EditRenderJob[] {
  return readProductionJson<EditRenderJob[]>(FILE, []);
}

function save(jobs: EditRenderJob[]): void {
  writeProductionJson(FILE, jobs.slice(-50));
}

export function createEditJob(): EditRenderJob {
  const job: EditRenderJob = {
    id: randomId(),
    status: "idle",
    progress: 0,
    message: "等待开始",
    startedAt: new Date().toISOString(),
  };
  const all = load();
  all.push(job);
  save(all);
  return job;
}

export function updateEditJob(id: string, patch: Partial<EditRenderJob>): EditRenderJob | null {
  const all = load();
  const idx = all.findIndex((j) => j.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  save(all);
  return all[idx];
}

export function getEditJob(id: string): EditRenderJob | null {
  return load().find((j) => j.id === id) ?? null;
}

/** 返回最近一条仍在进行中的渲染任务（刷新页面后用于恢复进度条） */
export function getActiveEditJob(): EditRenderJob | null {
  const all = load().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const latest = all[0];
  if (!latest || (latest.status !== "rendering" && latest.status !== "planning")) {
    return null;
  }
  const started = Date.parse(latest.startedAt);
  // 超过 6 小时仍显示 rendering 的视为孤儿任务（进程已死、状态未回写）
  if (Number.isFinite(started) && Date.now() - started > 6 * 60 * 60 * 1000) {
    return null;
  }
  return latest;
}

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
