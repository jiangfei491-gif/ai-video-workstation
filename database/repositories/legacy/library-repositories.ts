import { randomUUID } from "node:crypto";

import type {
  IMaterialRepository,
  ICharacterRepository,
  ISceneRepository,
  IPropRepository,
  PageParams,
  PageResult,
  UUID,
} from "../interfaces";
import { readJsonArray, writeJsonArray } from "../shared/json-store";

function paginate<T>(items: T[], params?: PageParams): PageResult<T> {
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 100;
  return { items: items.slice(offset, offset + limit), total: items.length };
}

export class LegacyMaterialRepository implements IMaterialRepository {
  async findById(id: UUID): Promise<unknown | null> {
    return readJsonArray<{ id: string }>("materials.json").find((m) => m.id === id) ?? null;
  }

  async listByWorkspace(_workspaceId: UUID, params?: PageParams): Promise<PageResult<unknown>> {
    const items = readJsonArray("materials.json").sort(
      (a, b) =>
        new Date((b as { createdAt?: string }).createdAt ?? 0).getTime() -
        new Date((a as { createdAt?: string }).createdAt ?? 0).getTime()
    );
    return paginate(items, params);
  }

  async create(input: unknown): Promise<unknown> {
    const record = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...(input as object),
    };
    const all = readJsonArray("materials.json");
    all.push(record);
    writeJsonArray("materials.json", all);
    return record;
  }

  async update(id: UUID, patch: unknown): Promise<unknown> {
    const all = readJsonArray<Record<string, unknown>>("materials.json");
    const idx = all.findIndex((m) => m.id === id);
    if (idx < 0) throw new Error(`Material not found: ${id}`);
    all[idx] = { ...all[idx], ...(patch as object), updatedAt: new Date().toISOString() };
    writeJsonArray("materials.json", all);
    return all[idx];
  }
}

export class LegacyCharacterRepository implements ICharacterRepository {
  async findById(id: UUID): Promise<unknown | null> {
    return readJsonArray<{ id: string }>("characters.json").find((c) => c.id === id) ?? null;
  }

  async listByWorkspace(_workspaceId: UUID): Promise<unknown[]> {
    return readJsonArray("characters.json").sort(
      (a, b) =>
        new Date((b as { createdAt?: string }).createdAt ?? 0).getTime() -
        new Date((a as { createdAt?: string }).createdAt ?? 0).getTime()
    );
  }

  async create(input: unknown): Promise<unknown> {
    const record = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...(input as object),
    };
    const all = readJsonArray("characters.json");
    all.push(record);
    writeJsonArray("characters.json", all);
    return record;
  }
}

export class LegacySceneRepository implements ISceneRepository {
  async findById(id: UUID): Promise<unknown | null> {
    return readJsonArray<{ id: string }>("scenes.json").find((s) => s.id === id) ?? null;
  }

  async listByWorkspace(_workspaceId: UUID): Promise<unknown[]> {
    return readJsonArray("scenes.json");
  }

  async create(input: unknown): Promise<unknown> {
    const record = { id: randomUUID(), createdAt: new Date().toISOString(), ...(input as object) };
    const all = readJsonArray("scenes.json");
    all.push(record);
    writeJsonArray("scenes.json", all);
    return record;
  }
}

export class LegacyPropRepository implements IPropRepository {
  async findById(id: UUID): Promise<unknown | null> {
    return readJsonArray<{ id: string }>("props.json").find((p) => p.id === id) ?? null;
  }

  async listByWorkspace(_workspaceId: UUID): Promise<unknown[]> {
    return readJsonArray("props.json");
  }

  async create(input: unknown): Promise<unknown> {
    const record = { id: randomUUID(), createdAt: new Date().toISOString(), ...(input as object) };
    const all = readJsonArray("props.json");
    all.push(record);
    writeJsonArray("props.json", all);
    return record;
  }
}
