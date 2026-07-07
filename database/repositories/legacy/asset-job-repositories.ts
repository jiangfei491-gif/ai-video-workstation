import { randomUUID } from "node:crypto";

import type {
  IAssetRepository,
  IJobRepository,
  PageParams,
  PageResult,
  UUID,
} from "../interfaces";
import { readJsonArray, writeJsonArray } from "../shared/json-store";

export class LegacyAssetRepository implements IAssetRepository {
  async create(input: unknown): Promise<unknown> {
    const record = { id: randomUUID(), createdAt: new Date().toISOString(), ...(input as object) };
    const all = readJsonArray("image-assets.json");
    all.push(record);
    writeJsonArray("image-assets.json", all);
    return record;
  }

  async findById(id: UUID): Promise<unknown | null> {
    return readJsonArray<{ id: string }>("image-assets.json").find((a) => a.id === id) ?? null;
  }

  async findByStorageKey(_bucket: string, key: string): Promise<unknown | null> {
    return (
      readJsonArray<{ filepath?: string; url?: string }>("image-assets.json").find(
        (a) => a.filepath === key || a.url?.includes(key)
      ) ?? null
    );
  }

  async listByProject(_projectId: UUID, _kind?: string): Promise<unknown[]> {
    return readJsonArray("image-assets.json");
  }

  async linkToProject(_projectId: UUID, _assetId: UUID, _meta: unknown): Promise<void> {
    /* Legacy：项目关联存于 workbench localStorage，P1 不写入 */
  }

  async linkToShot(_projectId: UUID, _shotIndex: number, _assetId: UUID, _role: string): Promise<void> {
    /* Legacy：镜头关联存于 workbench localStorage */
  }
}

export class LegacyJobRepository implements IJobRepository {
  private load() {
    return readJsonArray<Record<string, unknown>>("auto-edit-jobs.json");
  }

  private save(jobs: Record<string, unknown>[]) {
    writeJsonArray("auto-edit-jobs.json", jobs.slice(-50));
  }

  async create(input: unknown): Promise<unknown> {
    const job = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      status: "idle",
      progress: 0,
      message: "等待开始",
      startedAt: new Date().toISOString(),
      ...(input as object),
    };
    const all = this.load();
    all.push(job);
    this.save(all);
    return job;
  }

  async findById(id: UUID): Promise<unknown | null> {
    return this.load().find((j) => j.id === id) ?? null;
  }

  async updateStatus(id: UUID, patch: unknown): Promise<unknown> {
    const all = this.load();
    const idx = all.findIndex((j) => j.id === id);
    if (idx < 0) throw new Error(`Job not found: ${id}`);
    all[idx] = { ...all[idx], ...(patch as object) };
    this.save(all);
    return all[idx];
  }

  async appendStep(jobId: UUID, step: unknown): Promise<unknown> {
    const all = this.load();
    const idx = all.findIndex((j) => j.id === jobId);
    if (idx < 0) throw new Error(`Job not found: ${jobId}`);
    const steps = Array.isArray(all[idx].steps) ? [...(all[idx].steps as unknown[])] : [];
    steps.push(step);
    all[idx] = { ...all[idx], steps };
    this.save(all);
    return step;
  }

  async listByProject(_projectId: UUID, params?: PageParams): Promise<PageResult<unknown>> {
    const items = this.load();
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 50;
    return { items: items.slice(offset, offset + limit), total: items.length };
  }
}
