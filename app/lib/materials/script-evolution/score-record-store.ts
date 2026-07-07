import { randomUUID } from "crypto";
import {
  readProductionJson,
  writeProductionJson,
} from "@/app/lib/storage/production-json";
import type { ScoreRecord, ScoreRecordTargetType } from "./types";

const FILE = "script-evolution-score-records.json";

function load(): ScoreRecord[] {
  return readProductionJson<ScoreRecord[]>(FILE, []);
}

function save(records: ScoreRecord[]): void {
  writeProductionJson(FILE, records);
}

export function listScoreRecords(params?: {
  materialId?: string;
  evolutionRunId?: string;
  targetId?: string;
  limit?: number;
}): ScoreRecord[] {
  let list = load();
  if (params?.materialId) list = list.filter((r) => r.materialId === params.materialId);
  if (params?.evolutionRunId) list = list.filter((r) => r.evolutionRunId === params.evolutionRunId);
  if (params?.targetId) list = list.filter((r) => r.targetId === params.targetId);
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (params?.limit) list = list.slice(0, params.limit);
  return list;
}

export function appendScoreRecords(records: Omit<ScoreRecord, "id" | "createdAt">[]): ScoreRecord[] {
  const all = load();
  const created = records.map((r) => ({
    ...r,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  }));
  all.unshift(...created);
  if (all.length > 20000) all.length = 20000;
  save(all);
  return created;
}

export function createScoreRecord(
  input: Omit<ScoreRecord, "id" | "createdAt">
): ScoreRecord {
  return appendScoreRecords([input])[0];
}

export type ScoreRecordInput = {
  evolutionRunId: string;
  materialId: string;
  category: string;
  targetId: string;
  targetType: ScoreRecordTargetType;
  generatorProvider: ScoreRecord["generatorProvider"];
  style: ScoreRecord["style"];
  judgeProvider: ScoreRecord["judgeProvider"];
  judgeModel?: string;
  scores: ScoreRecord["scores"];
  total: number;
  rank?: number;
  deductReasons?: string;
  brief?: string;
};
