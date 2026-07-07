import { readFile, writeFile } from "fs/promises";

import { estimateCostUsd, MODEL_PRICING } from "@/app/lib/cost-ledger/pricing";
import { getWorkspaceManager } from "@/database/workspace";
import { runtimeDataFilePath } from "@/app/lib/storage/workspace-paths";

export { MODEL_PRICING, estimateCostUsd };

export type UsageRecordInput = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type UsageStats = {
  todayTokens: number;
  monthTokens: number;
  estimatedCost: number;
  model: string;
  successRate: number;
  todayRequests: number;
  monthRequests: number;
  todayErrors: number;
  monthErrors: number;
};

type UsageStore = {
  month: string;
  monthInputTokens: number;
  monthOutputTokens: number;
  monthCost: number;
  monthRequests: number;
  monthSuccesses: number;
  monthErrors: number;
  today: string;
  todayInputTokens: number;
  todayOutputTokens: number;
  todayCost: number;
  todayRequests: number;
  todaySuccesses: number;
  todayErrors: number;
  lastModel: string;
};

const STORE_FILE = runtimeDataFilePath("openai-usage-stats.json");

function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyStore(): UsageStore {
  return {
    month: monthKey(),
    monthInputTokens: 0,
    monthOutputTokens: 0,
    monthCost: 0,
    monthRequests: 0,
    monthSuccesses: 0,
    monthErrors: 0,
    today: todayKey(),
    todayInputTokens: 0,
    todayOutputTokens: 0,
    todayCost: 0,
    todayRequests: 0,
    todaySuccesses: 0,
    todayErrors: 0,
    lastModel: "gpt-4.1",
  };
}

function rollStore(store: UsageStore): UsageStore {
  const next = { ...store };
  const nowMonth = monthKey();
  const nowDay = todayKey();

  if (next.month !== nowMonth) {
    next.month = nowMonth;
    next.monthInputTokens = 0;
    next.monthOutputTokens = 0;
    next.monthCost = 0;
    next.monthRequests = 0;
    next.monthSuccesses = 0;
    next.monthErrors = 0;
  }

  if (next.today !== nowDay) {
    next.today = nowDay;
    next.todayInputTokens = 0;
    next.todayOutputTokens = 0;
    next.todayCost = 0;
    next.todayRequests = 0;
    next.todaySuccesses = 0;
    next.todayErrors = 0;
  }

  return next;
}

async function readStore(): Promise<UsageStore> {
  try {
    const raw = await readFile(STORE_FILE, "utf-8");
    return rollStore(JSON.parse(raw) as UsageStore);
  } catch {
    return rollStore(emptyStore());
  }
}

async function writeStore(store: UsageStore): Promise<void> {
  getWorkspaceManager().ensureLayout();
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export async function recordUsage(input: UsageRecordInput): Promise<void> {
  const inputTokens = Math.max(0, input.inputTokens);
  const outputTokens = Math.max(0, input.outputTokens);
  if (inputTokens === 0 && outputTokens === 0) return;

  const store = rollStore(await readStore());
  const cost = estimateCostUsd(input.model, inputTokens, outputTokens);

  store.lastModel = input.model;
  store.todayInputTokens += inputTokens;
  store.todayOutputTokens += outputTokens;
  store.todayCost += cost;
  store.todayRequests += 1;
  store.todaySuccesses += 1;
  store.monthInputTokens += inputTokens;
  store.monthOutputTokens += outputTokens;
  store.monthCost += cost;
  store.monthRequests += 1;
  store.monthSuccesses += 1;

  await writeStore(store);

  console.info("[usage-tracker] recorded", {
    model: input.model,
    inputTokens,
    outputTokens,
    total: inputTokens + outputTokens,
    cost: cost.toFixed(6),
  });
}

export async function recordRequestError(model?: string): Promise<void> {
  const store = rollStore(await readStore());
  if (model) store.lastModel = model;
  store.todayRequests += 1;
  store.todayErrors += 1;
  store.monthRequests += 1;
  store.monthErrors += 1;
  await writeStore(store);
}

export async function getUsageStats(defaultModel = "gpt-4.1"): Promise<UsageStats> {
  const store = await readStore();
  const todayTokens = store.todayInputTokens + store.todayOutputTokens;
  const monthTokens = store.monthInputTokens + store.monthOutputTokens;
  const totalAttempts = store.monthSuccesses + store.monthErrors;
  const successRate =
    totalAttempts > 0
      ? Math.round((store.monthSuccesses / totalAttempts) * 1000) / 10
      : 100;

  return {
    todayTokens,
    monthTokens,
    estimatedCost: Math.round(store.monthCost * 100) / 100,
    model: store.lastModel || defaultModel,
    successRate,
    todayRequests: store.todayRequests,
    monthRequests: store.monthRequests,
    todayErrors: store.todayErrors,
    monthErrors: store.monthErrors,
  };
}

export async function getTodayTokenUsage(): Promise<number> {
  const store = await readStore();
  return store.todayInputTokens + store.todayOutputTokens;
}

/** @deprecated 请使用 recordUsage */
export async function recordTokenUsage(totalTokens: number): Promise<void> {
  await recordUsage({
    model: "gpt-4.1",
    inputTokens: Math.floor(totalTokens * 0.3),
    outputTokens: Math.ceil(totalTokens * 0.7),
  });
}
