import {
  readProductionJson,
  writeProductionJson,
} from "@/app/lib/storage/production-json";
import type { EvolutionRun } from "./types";

const FILE = "script-evolution-runs.json";

type Store = {
  runs: EvolutionRun[];
};

function load(): Store {
  return readProductionJson<Store>(FILE, { runs: [] });
}

function save(store: Store): void {
  writeProductionJson(FILE, store);
}

export function saveEvolutionRun(run: EvolutionRun): void {
  const store = load();
  const idx = store.runs.findIndex((r) => r.id === run.id);
  if (idx === -1) store.runs.unshift(run);
  else store.runs[idx] = run;
  if (store.runs.length > 500) store.runs.length = 500;
  save(store);
}

export function getEvolutionRun(id: string): EvolutionRun | null {
  return load().runs.find((r) => r.id === id) ?? null;
}

export function listEvolutionRunsForMaterial(materialId: string): EvolutionRun[] {
  return load()
    .runs.filter((r) => r.materialId === materialId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}
