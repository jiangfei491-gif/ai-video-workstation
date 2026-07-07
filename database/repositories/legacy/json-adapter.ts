import type { ILegacyJsonAdapter, UUID } from "../interfaces";
import { readJsonArray, writeJsonArray } from "../shared/json-store";

const LEGACY_MAP_FILE = "legacy-json-mappings.json";

type LegacyMapping = {
  source: string;
  legacy_key: string;
  entity_type: string;
  entity_id: UUID;
};

export class LegacyJsonAdapter implements ILegacyJsonAdapter {
  async readMaterials(): Promise<unknown[]> {
    return readJsonArray("materials.json");
  }

  async readCharacters(): Promise<unknown[]> {
    return readJsonArray("characters.json");
  }

  async readScenes(): Promise<unknown[]> {
    return readJsonArray("scenes.json");
  }

  async readProps(): Promise<unknown[]> {
    return readJsonArray("props.json");
  }

  async readImageAssets(): Promise<unknown[]> {
    return readJsonArray("image-assets.json");
  }

  async readShotLocks(): Promise<unknown[]> {
    return readJsonArray("shot-locks.json");
  }

  async readEditJobs(): Promise<unknown[]> {
    return readJsonArray("auto-edit-jobs.json");
  }

  async mapLegacyKey(
    source: string,
    legacyKey: string,
    entityType: string,
    entityId: UUID
  ): Promise<void> {
    const mappings = readJsonArray<LegacyMapping>(LEGACY_MAP_FILE);
    const exists = mappings.some(
      (m) => m.source === source && m.legacy_key === legacyKey
    );
    if (exists) return;
    mappings.push({
      source,
      legacy_key: legacyKey,
      entity_type: entityType,
      entity_id: entityId,
    });
    writeJsonArray(LEGACY_MAP_FILE, mappings);
  }
}

export function createLegacyJsonAdapter(): ILegacyJsonAdapter {
  return new LegacyJsonAdapter();
}
