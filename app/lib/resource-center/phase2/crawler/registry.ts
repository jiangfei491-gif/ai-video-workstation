import type { CrawlerProvider } from "./provider";
import { GenericHttpCrawlerProvider, GenericRssCrawlerProvider } from "./providers/generic";
import { CivitaiCrawlerProvider } from "./providers/civitai";
import { HuggingFaceCrawlerProvider } from "./providers/huggingface";
import { UnsplashCrawlerProvider } from "./providers/unsplash";
import { FreesoundCrawlerProvider } from "./providers/freesound";
import { SubdlCrawlerProvider } from "./providers/subdl";
import { PixabayCrawlerProvider } from "./providers/pixabay";
import { JamendoCrawlerProvider } from "./providers/jamendo";
import { PexelsCrawlerProvider } from "./providers/pexels";
import { ElevenLabsCrawlerProvider } from "./providers/elevenlabs";

const registry = new Map<string, CrawlerProvider>();

function register(provider: CrawlerProvider): void {
  registry.set(provider.slug, provider);
}

register(new GenericHttpCrawlerProvider());
register(new GenericRssCrawlerProvider());
register(new CivitaiCrawlerProvider());
register(new HuggingFaceCrawlerProvider());
register(new UnsplashCrawlerProvider());
register(new FreesoundCrawlerProvider());
register(new SubdlCrawlerProvider());
register(new PixabayCrawlerProvider());
register(new JamendoCrawlerProvider());
register(new PexelsCrawlerProvider());
register(new ElevenLabsCrawlerProvider());

export function getCrawlerProvider(slug: string): CrawlerProvider | undefined {
  return registry.get(slug);
}

export function listCrawlerProviders(): CrawlerProvider[] {
  return [...registry.values()];
}

export function requireCrawlerProvider(slug: string): CrawlerProvider {
  const p = getCrawlerProvider(slug);
  if (!p) throw new Error(`未注册的 CrawlerProvider: ${slug}`);
  return p;
}

export function registerCrawlerProvider(provider: CrawlerProvider): void {
  register(provider);
}
