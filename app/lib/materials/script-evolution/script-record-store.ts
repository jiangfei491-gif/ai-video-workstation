import { randomUUID } from "crypto";
import {
  readProductionJson,
  writeProductionJson,
} from "@/app/lib/storage/production-json";
import type { ScriptRecord, ScriptRecordRole } from "./types";

const FILE = "script-evolution-script-records.json";

function load(): ScriptRecord[] {
  return readProductionJson<ScriptRecord[]>(FILE, []);
}

function save(records: ScriptRecord[]): void {
  writeProductionJson(FILE, records);
}

export function countScriptWords(text?: string): number {
  if (!text) return 0;
  return text.replace(/\s/g, "").length;
}

export function listScriptRecords(params?: {
  materialId?: string;
  evolutionRunId?: string;
  limit?: number;
}): ScriptRecord[] {
  let list = load();
  if (params?.materialId) list = list.filter((r) => r.materialId === params.materialId);
  if (params?.evolutionRunId) list = list.filter((r) => r.evolutionRunId === params.evolutionRunId);
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (params?.limit) list = list.slice(0, params.limit);
  return list;
}

export function getScriptRecord(id: string): ScriptRecord | null {
  return load().find((r) => r.id === id) ?? null;
}

export function createScriptRecord(
  input: Omit<ScriptRecord, "id" | "createdAt" | "selectedForPublish" | "published"> & {
    id?: string;
    selectedForPublish?: boolean;
    published?: boolean;
  }
): ScriptRecord {
  const record: ScriptRecord = {
    ...input,
    id: input.id ?? randomUUID(),
    selectedForPublish: input.selectedForPublish ?? false,
    published: input.published ?? false,
    createdAt: new Date().toISOString(),
  };
  const all = load();
  all.unshift(record);
  if (all.length > 5000) all.length = 5000;
  save(all);
  return record;
}

export function updateScriptRecord(
  id: string,
  patch: Partial<
    Pick<
      ScriptRecord,
      | "selectedForPublish"
      | "published"
      | "publishedAt"
      | "videoUrl"
      | "youtubeMetrics"
      | "humanScore"
      | "humanNote"
    >
  >
): ScriptRecord {
  const all = load();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error("脚本记录不存在");
  const next: ScriptRecord = {
    ...all[idx],
    ...patch,
    ...(patch.published === true && !patch.publishedAt
      ? { publishedAt: new Date().toISOString() }
      : {}),
    ...(patch.youtubeMetrics
      ? {
          youtubeMetrics: {
            ...all[idx].youtubeMetrics,
            ...patch.youtubeMetrics,
            updatedAt: new Date().toISOString(),
          },
        }
      : {}),
  };
  all[idx] = next;
  save(all);
  return next;
}

export type ScriptRecordInput = {
  evolutionRunId: string;
  materialId: string;
  materialTitle: string;
  category: string;
  role: ScriptRecordRole;
  provider: ScriptRecord["provider"];
  style: ScriptRecord["style"];
  model: string;
  durationMinutes: number;
  targetWordCount: number;
  outline?: string;
  script?: string;
  outlineId?: string;
  rank?: number;
  aggregatedScore?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  generationMs?: number;
};

export function createScriptRecordFromInput(input: ScriptRecordInput): ScriptRecord {
  const text = input.script ?? input.outline ?? "";
  const costUsd = input.costUsd ?? 0;
  return createScriptRecord({
    ...input,
    actualWordCount: countScriptWords(text),
    inputTokens: input.inputTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
    costUsd,
    costCny: Math.round(costUsd * 7.2 * 100) / 100,
    generationMs: input.generationMs ?? 0,
  });
}
