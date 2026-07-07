import { findMaterials } from "@/app/lib/materials/agent";
import { analyzeMaterial } from "@/app/lib/materials/analyze";
import {
  createMaterial,
  listMaterials,
  setMaterialAnalysis,
} from "@/app/lib/materials/store";
import {
  resolveFoundMaterialCategory,
  resolveFoundMaterialLanguage,
  resolveMaterialSearchCategory,
  resolveMaterialSearchLanguage,
  resolveMaterialSearchProvider,
  type Material,
} from "@/app/lib/materials/types";

export type RunMaterialAgentParams = {
  task: string;
  count?: number;
  category?: string;
  language?: string;
  searchProvider?: string;
  autoAnalyze?: boolean;
};

export type RunMaterialAgentResult = {
  found: number;
  created: number;
  skipped: number;
  materials: Material[];
  searchProvider?: string;
  searchModel?: string;
};

function norm(u: string): string {
  return u.trim().toLowerCase().replace(/\/+$/, "");
}

export async function runMaterialAgentJob(
  body: RunMaterialAgentParams
): Promise<RunMaterialAgentResult> {
  const task = body.task.trim();
  if (!task) throw new Error("请填写任务（要找什么素材）");

  const count = Math.max(1, Math.min(20, Math.floor(body.count ?? 5)));
  const category = resolveMaterialSearchCategory(body.category);
  const language = resolveMaterialSearchLanguage(body.language);
  const searchProvider = resolveMaterialSearchProvider(body.searchProvider);

  const { items: found, searchProvider: usedProvider, searchModel } = await findMaterials({
    task,
    count,
    category,
    language,
    searchProvider,
  });

  const existing = listMaterials();
  const seenUrls = new Set(existing.map((m) => norm(m.url)).filter(Boolean));
  const seenTitles = new Set(existing.map((m) => m.title.trim()));

  const created: Material[] = [];
  for (const f of found) {
    if (f.sourceUrl && seenUrls.has(norm(f.sourceUrl))) continue;
    if (seenTitles.has(f.title.trim())) continue;
    seenUrls.add(norm(f.sourceUrl));
    seenTitles.add(f.title.trim());

    let material = createMaterial({
      title: f.title,
      content: f.content,
      source: f.sourceSite || "Agent",
      url: f.sourceUrl,
      category: resolveFoundMaterialCategory(f.category, category),
      ...(() => {
        const lang = resolveFoundMaterialLanguage(f.language, language);
        return lang && lang !== "zh" ? { language: lang } : {};
      })(),
    });

    if (body.autoAnalyze) {
      try {
        const analysis = await analyzeMaterial(material.title, material.content);
        material = setMaterialAnalysis(material.id, analysis);
      } catch {
        /* 分析失败不阻断入库 */
      }
    }
    created.push(material);
  }

  return {
    found: found.length,
    created: created.length,
    skipped: found.length - created.length,
    materials: created,
    searchProvider: usedProvider,
    searchModel,
  };
}
