import { getOpenAIApiKey } from "@/app/lib/openai-key";
import type {
  GenerateImageInput,
  GenerateImageOutput,
  ImageProviderId,
  ProviderAvailability,
} from "./types";
import { generateOpenAI } from "./openai-provider";
import { generateBflFlux, isBflConfigured, getBflConfigHint } from "./bfl-flux-provider";
import { generateFalFlux, isFalConfigured } from "./fal-flux-provider";

export function getProviderAvailability(): ProviderAvailability {
  return {
    flux: isBflConfigured() || isFalConfigured(),
    bfl: isBflConfigured(),
    fal: isFalConfigured(),
    openai: !!getOpenAIApiKey(),
    imagen: !!(process.env.VEO_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()),
  };
}

export { getBflConfigHint };

/** 判断是否为"额度不足/未开通计费"类错误（OpenAI 欠费、429、insufficient_quota 等） */
export function isNoCreditError(e: unknown): boolean {
  const err = e as { status?: number; code?: string; message?: string } | undefined;
  const msg = (err?.message ?? "").toLowerCase();
  return (
    err?.status === 429 ||
    err?.code === "insufficient_quota" ||
    msg.includes("insufficient_quota") ||
    msg.includes("exceeded your current quota") ||
    msg.includes("billing") ||
    (msg.includes("quota") && msg.includes("exceed"))
  );
}

/** 生成面向用户的错误说明（区分"没额度"与其它失败） */
export function describeImageError(e: unknown, provider: string): string {
  const err = e as { message?: string; status?: number } | undefined;
  if (isNoCreditError(e)) {
    return `${provider} 暂不可用：账户额度不足或未开通计费${err?.status ? `（HTTP ${err.status}）` : ""}。`;
  }
  return `${provider} 生成失败：${err?.message ?? String(e)}`;
}

/**
 * 先试 OpenAI，失败（含没额度）时自动回退 Flux（BFL → FAL）。
 * 两者都不可用时，抛出明确的用户可读提示。
 */
async function openAIThenFlux(
  openaiCall: () => Promise<GenerateImageOutput[]>,
  input: GenerateImageInput,
  fluxVariant: "flux-dev" | "flux-schnell" = "flux-dev"
): Promise<GenerateImageOutput[]> {
  const hasFlux = isBflConfigured() || isFalConfigured();
  if (getOpenAIApiKey()) {
    try {
      return await openaiCall();
    } catch (e) {
      if (!hasFlux) {
        throw new Error(
          `${describeImageError(e, "OpenAI 图像")}且未配置 Flux 回退（BFL_API_KEY / FAL_KEY）。` +
            `请为 OpenAI 充值，或配置 Flux / 改用 Gemini 图像模型。`
        );
      }
      console.warn(`[image] OpenAI 生成失败，自动回退 Flux：${describeImageError(e, "OpenAI 图像")}`);
    }
  }
  if (isBflConfigured()) return generateBflFlux(fluxVariant, input);
  if (isFalConfigured()) return generateFalFlux(fluxVariant, input);
  throw new Error(
    "图像生成不可用：OpenAI 无额度或未配置，且未配置 Flux（BFL_API_KEY / FAL_KEY）。请配置任一图像 Provider。"
  );
}

/** Tier 1 草稿：优先 BFL 官方 → FAL → OpenAI 回退 */
export async function generateTier1Draft(
  input: GenerateImageInput,
  preferDev = false
): Promise<GenerateImageOutput[]> {
  const variant = preferDev ? "flux-dev" : "flux-schnell";
  if (isBflConfigured()) {
    return generateBflFlux(variant, input);
  }
  if (isFalConfigured()) {
    return generateFalFlux(variant, input);
  }
  if (getOpenAIApiKey()) {
    return generateOpenAI("gpt-image-1", input);
  }
  throw new Error("未配置 BFL_API_KEY、FAL_KEY 或 OPENAI_API_KEY，无法生图");
}

/** Tier 3 精修：GPT Image 带参考图；OpenAI 失败（含没额度）自动回退 Flux */
export async function generateTier3Premium(
  input: GenerateImageInput
): Promise<GenerateImageOutput[]> {
  return openAIThenFlux(() => generateOpenAI("gpt-image-2", input), input, "flux-dev");
}

/** 标准模式精修：BFL FLUX dev 重生成（更强模型，低成本，走 BFL）；无 FLUX 时回退 GPT Image，OpenAI 也失败则给出明确提示 */
export async function generateFluxDevRefine(
  input: GenerateImageInput
): Promise<GenerateImageOutput[]> {
  if (isBflConfigured()) return generateBflFlux("flux-dev", input);
  if (isFalConfigured()) return generateFalFlux("flux-dev", input);
  return openAIThenFlux(() => generateOpenAI("gpt-image-2", input), input, "flux-dev");
}

/** Tier 3 备选：Imagen（暂与 GPT 同路径） */
export async function generateTier3Imagen(
  input: GenerateImageInput
): Promise<GenerateImageOutput[]> {
  return generateTier3Premium(input);
}

export async function generateWithProvider(
  providerId: ImageProviderId,
  input: GenerateImageInput
): Promise<GenerateImageOutput[]> {
  switch (providerId) {
    case "flux-schnell":
    case "flux-dev":
      if (isBflConfigured()) return generateBflFlux(providerId, input);
      return generateFalFlux(providerId, input);
    case "gpt-image-2":
    case "gpt-image-1":
      return openAIThenFlux(() => generateOpenAI(providerId, input), input, "flux-dev");
    case "imagen-3":
      return generateTier3Imagen(input);
    default:
      throw new Error(`未知 provider: ${providerId}`);
  }
}
