import { NextResponse } from "next/server";
import { findMaterials } from "@/app/lib/materials/agent";
import { analyzeMaterial } from "@/app/lib/materials/analyze";
import {
  createMaterial,
  listMaterials,
  setMaterialAnalysis,
} from "@/app/lib/materials/store";
import { getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = {
  task?: string;
  count?: number;
  category?: string;
  autoAnalyze?: boolean;
};

function norm(u: string): string {
  return u.trim().toLowerCase().replace(/\/+$/, "");
}

export async function POST(req: Request) {
  if (!getOpenAIApiKey()) {
    return NextResponse.json({ error: "未配置 OPENAI_API_KEY" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const task = body.task?.trim();
  if (!task) return NextResponse.json({ error: "请填写任务（要找什么素材）" }, { status: 400 });
  const count = Math.max(1, Math.min(20, Math.floor(body.count ?? 5)));
  const category = body.category?.trim() || "故事";

  try {
    const found = await findMaterials({ task, count, category });

    // 去重：跳过已有相同网址/标题的素材
    const existing = listMaterials();
    const seenUrls = new Set(existing.map((m) => norm(m.url)).filter(Boolean));
    const seenTitles = new Set(existing.map((m) => m.title.trim()));

    const created = [];
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
        category,
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

    return NextResponse.json({
      found: found.length,
      created: created.length,
      skipped: found.length - created.length,
      materials: created,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent 运行失败" },
      { status: 502 }
    );
  }
}
