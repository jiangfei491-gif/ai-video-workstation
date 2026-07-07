import type { GenerateImageInput, GenerateImageOutput } from "./types";
import { estimateProviderCostUsd } from "./pricing";

const DEFAULT_BASE = "https://api.bfl.ai";

function readBflKey(): string | null {
  const raw = process.env.BFL_API_KEY ?? process.env.BFL_KEY;
  if (!raw) return null;
  const t = raw.trim().replace(/^['"]|['"]$/g, "");
  return t.length > 0 ? t : null;
}

function readBaseUrl(): string {
  const raw = process.env.BFL_API_BASE?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, "") : DEFAULT_BASE;
}

function sizeToDimensions(size: GenerateImageInput["size"]): {
  width: number;
  height: number;
} {
  if (size === "1536x1024") return { width: 1536, height: 864 };
  if (size === "1024x1024") return { width: 1024, height: 1024 };
  return { width: 832, height: 1472 };
}

function snapBflDimension(value: number): number {
  return Math.max(32, Math.round(value / 32) * 32);
}

function resolveDimensions(input: GenerateImageInput): { width: number; height: number } {
  if (input.dimensions) {
    return {
      width: snapBflDimension(input.dimensions.width),
      height: snapBflDimension(input.dimensions.height),
    };
  }
  const { width, height } = sizeToDimensions(input.size);
  return { width: snapBflDimension(width), height: snapBflDimension(height) };
}

function endpointForVariant(variant: "flux-schnell" | "flux-dev"): string {
  // Schnell → 最快 klein 4B；Dev → flux-dev 开源档
  return variant === "flux-schnell" ? "/v1/flux-2-klein-4b" : "/v1/flux-dev";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载 BFL 图片失败 [${res.status}]`);
  return Buffer.from(await res.arrayBuffer());
}

type BflSubmitResponse = {
  id?: string;
  polling_url?: string;
};

type BflPollResponse = {
  status?: string;
  result?: { sample?: string };
  error?: string;
  detail?: string;
};

async function submitAndPoll(
  apiKey: string,
  path: string,
  body: Record<string, unknown>
): Promise<string> {
  const base = readBaseUrl();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "x-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const errText = await res.text();
  if (res.status === 402) {
    throw new Error("BFL 余额不足，请先在 bfl.ai 充值后再试");
  }
  if (!res.ok) {
    throw new Error(`BFL 提交失败 [${res.status}]: ${errText.slice(0, 300)}`);
  }

  let submit: BflSubmitResponse;
  try {
    submit = JSON.parse(errText) as BflSubmitResponse;
  } catch {
    throw new Error("BFL 返回非 JSON");
  }

  const pollingUrl =
    submit.polling_url ??
    (submit.id ? `${base}/v1/get_result?id=${encodeURIComponent(submit.id)}` : null);
  if (!pollingUrl) throw new Error("BFL 未返回 polling_url");

  for (let attempt = 0; attempt < 180; attempt++) {
    await sleep(attempt < 5 ? 500 : 1000);
    const pollRes = await fetch(pollingUrl, {
      headers: { accept: "application/json", "x-key": apiKey },
    });
    const pollText = await pollRes.text();
    if (!pollRes.ok) {
      throw new Error(`BFL 轮询失败 [${pollRes.status}]: ${pollText.slice(0, 200)}`);
    }
    const data = JSON.parse(pollText) as BflPollResponse;
    const status = data.status ?? "";
    if (status === "Ready" && data.result?.sample) {
      return data.result.sample;
    }
    if (status === "Error" || status === "Failed") {
      throw new Error(data.error ?? data.detail ?? "BFL 生图失败");
    }
  }

  throw new Error("BFL 生图超时（轮询 3 分钟）");
}

/** Tier 1 — BFL 官方 FLUX API */
export async function generateBflFlux(
  variant: "flux-schnell" | "flux-dev",
  input: GenerateImageInput
): Promise<GenerateImageOutput[]> {
  const apiKey = readBflKey();
  if (!apiKey) throw new Error("未配置 BFL_API_KEY");

  const count = Math.max(1, Math.min(4, input.count ?? 1));
  const { width, height } = resolveDimensions(input);
  const path = endpointForVariant(variant);

  const outputs: GenerateImageOutput[] = [];
  for (let i = 0; i < count; i++) {
    const sampleUrl = await submitAndPoll(apiKey, path, {
      prompt: input.prompt,
      width,
      height,
      output_format: "png",
      safety_tolerance: 2,
    });
    outputs.push({
      buffer: await downloadBuffer(sampleUrl),
      model: variant,
      source: `bfl-${variant}`,
      usedReferences: false,
      providerId: variant,
      tier: 1,
      estimatedCostUsd: estimateProviderCostUsd(variant),
    });
  }
  return outputs;
}

export function isBflConfigured(): boolean {
  return !!readBflKey();
}

export function getBflConfigHint(): { configured: boolean; baseUrl: string } {
  return { configured: isBflConfigured(), baseUrl: readBaseUrl() };
}
