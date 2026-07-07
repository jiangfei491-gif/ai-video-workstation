import { estimateCostUsd } from "@/app/lib/cost-ledger/pricing";
import type {
  ApiUsage,
  CallCostLine,
  DirectorCostDetail,
  ProjectCostLedger,
  ShotPipelineCostDetail,
  TokenCostLine,
} from "./types";

export function emptyTokenLine(): TokenCostLine {
  return { model: "—", inputTokens: 0, outputTokens: 0, costUsd: 0 };
}

export function emptyCallLine(): CallCostLine {
  return {
    calls: 0,
    costPerCallUsd: 0,
    totalCostUsd: 0,
    model: "—",
    inputTokens: 0,
    outputTokens: 0,
  };
}

export function tokenLineFromUsage(
  model: string,
  inputTokens: number,
  outputTokens: number
): TokenCostLine {
  return {
    model,
    inputTokens,
    outputTokens,
    costUsd: estimateCostUsd(model, inputTokens, outputTokens),
  };
}

export function mergeTokenLine(a: TokenCostLine, b: TokenCostLine): TokenCostLine {
  if (b.inputTokens === 0 && b.outputTokens === 0 && b.costUsd === 0) return a;
  if (a.inputTokens === 0 && a.outputTokens === 0 && a.costUsd === 0) return b;
  return {
    model: b.model !== "—" ? b.model : a.model,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costUsd: Math.round((a.costUsd + b.costUsd) * 1e6) / 1e6,
  };
}

export function addCallCost(
  line: CallCostLine,
  costUsd: number,
  calls = 1,
  usage?: Pick<ApiUsage, "model" | "inputTokens" | "outputTokens">
): CallCostLine {
  if (calls <= 0) return line;
  const totalCostUsd = Math.round((line.totalCostUsd + Math.max(0, costUsd)) * 1e6) / 1e6;
  const totalCalls = line.calls + calls;
  const inputTokens = line.inputTokens + (usage?.inputTokens ?? 0);
  const outputTokens = line.outputTokens + (usage?.outputTokens ?? 0);
  const model =
    usage?.model && usage.model !== "—"
      ? line.model === "—"
        ? usage.model
        : line.model === usage.model
          ? line.model
          : `${line.model}+${usage.model}`
      : line.model;
  return {
    calls: totalCalls,
    totalCostUsd,
    costPerCallUsd:
      totalCalls > 0 ? Math.round((totalCostUsd / totalCalls) * 1e6) / 1e6 : 0,
    model,
    inputTokens,
    outputTokens,
  };
}

export function addCallUsage(line: CallCostLine, usage: ApiUsage, calls = 1): CallCostLine {
  return addCallCost(line, usage.costUsd, calls, usage);
}

export function mergeCallLine(a: CallCostLine, b: CallCostLine): CallCostLine {
  if (b.calls === 0) return a;
  if (a.calls === 0) return b;
  const totalCostUsd = Math.round((a.totalCostUsd + b.totalCostUsd) * 1e6) / 1e6;
  const calls = a.calls + b.calls;
  const model =
    a.model === "—"
      ? b.model
      : b.model === "—" || a.model === b.model
        ? a.model
        : `${a.model}+${b.model}`;
  return {
    calls,
    totalCostUsd,
    costPerCallUsd: Math.round((totalCostUsd / calls) * 1e6) / 1e6,
    model,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
}

export function sumLedgerUsd(ledger: Omit<ProjectCostLedger, "totalCostUsd" | "updatedAt">): number {
  return (
    ledger.script.costUsd +
    ledger.storyboard.costUsd +
    ledger.prompts.costUsd +
    ledger.flux.totalCostUsd +
    ledger.visionQc.totalCostUsd +
    ledger.gptImage.totalCostUsd
  );
}

export function emptyProjectCostLedger(): ProjectCostLedger {
  return {
    script: emptyTokenLine(),
    storyboard: emptyTokenLine(),
    prompts: emptyTokenLine(),
    flux: emptyCallLine(),
    visionQc: emptyCallLine(),
    gptImage: emptyCallLine(),
    totalCostUsd: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function ledgerFromDirector(detail: DirectorCostDetail): ProjectCostLedger {
  const base = emptyProjectCostLedger();
  return finalizeLedger({
    ...base,
    script: detail.script,
    storyboard: detail.storyboard,
    prompts: detail.prompts,
  });
}

export function mergeDirectorIntoLedger(
  ledger: ProjectCostLedger | null | undefined,
  detail: DirectorCostDetail
): ProjectCostLedger {
  const base = ledger ?? emptyProjectCostLedger();
  return finalizeLedger({
    ...base,
    script: mergeTokenLine(base.script, detail.script),
    storyboard: mergeTokenLine(base.storyboard, detail.storyboard),
    prompts: mergeTokenLine(base.prompts, detail.prompts),
  });
}

export function mergeShotCostIntoLedger(
  ledger: ProjectCostLedger | null | undefined,
  detail: ShotPipelineCostDetail
): ProjectCostLedger {
  const base = ledger ?? emptyProjectCostLedger();
  return finalizeLedger({
    ...base,
    flux: mergeCallLine(base.flux, detail.flux),
    visionQc: mergeCallLine(base.visionQc, detail.visionQc),
    gptImage: mergeCallLine(base.gptImage, detail.gptImage),
  });
}

export function finalizeLedger(
  ledger: Omit<ProjectCostLedger, "totalCostUsd" | "updatedAt">
): ProjectCostLedger {
  const totalCostUsd = Math.round(sumLedgerUsd(ledger) * 100) / 100;
  return {
    ...ledger,
    totalCostUsd,
    updatedAt: new Date().toISOString(),
  };
}

export function formatUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

export function formatTokens(n: number): string {
  return n.toLocaleString("zh-CN");
}
