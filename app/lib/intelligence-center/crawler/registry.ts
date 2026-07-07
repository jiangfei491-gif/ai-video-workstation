import { IC_PLATFORMS } from "../platforms";
import type { IcPlatformId } from "../types";
import { createPlaceholderProvider, type IcProvider } from "./provider";
import { GithubProvider } from "./providers/github";
import { HuggingFaceProvider } from "./providers/huggingface";
import { ModelScopeProvider } from "./providers/modelscope";
import { NpmProvider } from "./providers/npm";
import { PypiProvider } from "./providers/pypi";
import { ArxivProvider } from "./providers/arxiv";
import { AiNewsProvider } from "./providers/ai-news";
import { ComfyUiProvider } from "./providers/comfyui";
import { McpProvider } from "./providers/mcp";
import { AiVideoProvider } from "./providers/ai-video";

/**
 * 统一 Provider 注册表。
 * 所有平台在此注册；以后新增平台只在这里 register 一个 Provider，Framework 不变。
 * 本阶段为每个平台注册占位 Provider（待接入 API）。
 */
const registry = new Map<string, IcProvider>();

export function registerIcProvider(provider: IcProvider): void {
  registry.set(provider.slug, provider);
}

export function getIcProvider(slug: string): IcProvider | undefined {
  return registry.get(slug);
}

export function getIcProviderForPlatform(platformId: IcPlatformId): IcProvider | undefined {
  return [...registry.values()].find((p) => p.platformId === platformId);
}

export function listIcProviders(): IcProvider[] {
  return [...registry.values()];
}

// 已接入真实 API 的 Provider（10 个平台全部接通）
const REAL_PROVIDERS: IcProvider[] = [
  new GithubProvider(),
  new HuggingFaceProvider(),
  new ModelScopeProvider(),
  new NpmProvider(),
  new PypiProvider(),
  new ArxivProvider(),
  new AiNewsProvider(),
  new ComfyUiProvider(),
  new McpProvider(),
  new AiVideoProvider(),
];
const REAL_PLATFORM_IDS = new Set<IcPlatformId>(REAL_PROVIDERS.map((p) => p.platformId));

for (const provider of REAL_PROVIDERS) {
  registerIcProvider(provider);
}

// 其余平台注册占位 Provider（架构就绪，待接入 API）
for (const platform of IC_PLATFORMS) {
  if (REAL_PLATFORM_IDS.has(platform.id)) continue;
  registerIcProvider(createPlaceholderProvider(platform.id, platform.name));
}
