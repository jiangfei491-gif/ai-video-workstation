import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { addMaterialScript, getMaterial } from "@/app/lib/materials/store";
import {
  clampDurationMinutes,
  runScriptEvolution,
} from "@/app/lib/materials/script-evolution/run-evolution";
import { listEvolutionRunsForMaterial } from "@/app/lib/materials/script-evolution/store";
import { listAvailableProviders } from "@/app/lib/materials/script-evolution/providers";
import { encodeSseEvent, sseResponse } from "@/app/lib/materials/script-evolution/sse";
import type { EvolutionRun } from "@/app/lib/materials/script-evolution/types";
import { SCRIPT_STYLES } from "@/app/lib/materials/script-evolution/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function styleLabel(style: string): string {
  return SCRIPT_STYLES.find((s) => s.id === style)?.label ?? style;
}

export async function GET(req: Request) {
  const materialId = new URL(req.url).searchParams.get("materialId")?.trim();
  if (!materialId) {
    return NextResponse.json({ error: "缺少 materialId" }, { status: 400 });
  }
  return NextResponse.json({
    providers: listAvailableProviders(),
    runs: listEvolutionRunsForMaterial(materialId),
  });
}

async function saveChampionScripts(
  materialId: string,
  materialTitle: string,
  run: EvolutionRun,
  saveToMaterial: boolean
) {
  if (!saveToMaterial) return null;

  const champion = run.candidates.find((c) => c.id === run.championId);
  const runnerUp = run.runnerUpId
    ? run.candidates.find((c) => c.id === run.runnerUpId)
    : undefined;

  if (!champion?.script) return null;

  let material = getMaterial(materialId);
  if (!material) return null;

  const durationTag =
    run.durationMinutes != null ? ` · ${run.durationMinutes}分钟` : "";

  if (runnerUp?.script) {
    material = addMaterialScript(materialId, {
      id: randomUUID(),
      title: `${materialTitle} · 进化亚军 (${runnerUp.provider}/${styleLabel(runnerUp.style)})${durationTag}`,
      script: runnerUp.script,
      language: "zh",
      createdAt: new Date().toISOString(),
    });
  }

  material = addMaterialScript(materialId, {
    id: randomUUID(),
    title: `${materialTitle} · 进化冠军 (${champion.provider}/${styleLabel(champion.style)})${durationTag}`,
    script: champion.script,
    language: "zh",
    createdAt: new Date().toISOString(),
  });

  return material;
}

export async function POST(req: Request) {
  const stream = new URL(req.url).searchParams.get("stream") === "1";

  let body: { id?: string; saveToMaterial?: boolean; durationMinutes?: number };
  try {
    body = (await req.json()) as {
      id?: string;
      saveToMaterial?: boolean;
      durationMinutes?: number;
    };
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) return NextResponse.json({ error: "缺少素材 ID" }, { status: 400 });

  const material = getMaterial(id);
  if (!material) return NextResponse.json({ error: "素材不存在" }, { status: 404 });

  if (listAvailableProviders().length === 0) {
    return NextResponse.json(
      { error: "未配置任何进化模型（至少需要 OPENAI_API_KEY 或 VEO_API_KEY）" },
      { status: 503 }
    );
  }

  const saveToMaterial = body.saveToMaterial !== false;
  const durationMinutes = clampDurationMinutes(body.durationMinutes ?? 1);
  const evolutionOptions = { durationMinutes };

  if (stream) {
    const sseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const push = (event: string, data: unknown) => {
          controller.enqueue(encodeSseEvent(event, data));
        };
        try {
          push("progress", { stage: "启动脚本进化 V2…" });
          const run = await runScriptEvolution(material, (r) => {
            push("progress", {
              stage: r.stage,
              status: r.status,
              candidateCount: r.candidates.length,
              outlineCount: r.outlines.length,
              rounds: r.rounds.length,
              run: r,
            });
          }, evolutionOptions);
          const materialOut = await saveChampionScripts(id, material.title, run, saveToMaterial);
          push("complete", { run, material: materialOut });
        } catch (err) {
          push("error", {
            error: err instanceof Error ? err.message : "脚本进化失败",
          });
        } finally {
          controller.close();
        }
      },
    });
    return sseResponse(sseStream);
  }

  try {
    const run = await runScriptEvolution(material, undefined, evolutionOptions);
    const materialOut =
      (await saveChampionScripts(id, material.title, run, saveToMaterial)) ?? material;
    return NextResponse.json({ run, material: materialOut });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "脚本进化失败" },
      { status: 502 }
    );
  }
}
