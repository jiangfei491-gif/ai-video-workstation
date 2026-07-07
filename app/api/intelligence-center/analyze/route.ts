import { NextResponse } from "next/server";
import { scoreItems, type IcScoreOptions } from "@/app/lib/intelligence-center/analyzer/scorer";
import type { IcModelId } from "@/app/lib/intelligence-center/analyzer/models";
import { getSettings } from "@/app/lib/intelligence-center/settings/store";
import { logEvent } from "@/app/lib/intelligence-center/event-log/store";
import type { IcDiscoveredItem, IcPlatformId } from "@/app/lib/intelligence-center/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/intelligence-center/analyze
 * body: { items: IcDiscoveredItem[], options?: IcScoreOptions }
 * 成本感知级联打分：本地预筛 → 便宜档批量 → 强档复核高分项。
 */
export async function POST(req: Request) {
  let body: { items?: IcDiscoveredItem[]; options?: IcScoreOptions };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体非法 JSON" }, { status: 400 });
  }
  const items = body.items ?? [];
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items 为空" }, { status: 400 });
  }
  if (items.length > 60) {
    return NextResponse.json({ error: "单次最多 60 项" }, { status: 400 });
  }
  // 设置作为默认值，请求 options 覆盖之
  const s = getSettings();
  const o = body.options ?? {};
  const opts: IcScoreOptions = {
    cheapModel: (o.cheapModel ?? s.defaultAnalyzerModel) as IcModelId,
    useStrong: o.useStrong ?? s.useStrongReview,
    strongModel: (o.strongModel ?? s.strongModel) as IcModelId,
    escalateMin: o.escalateMin ?? s.escalateMin,
    strongBudget: o.strongBudget ?? s.strongBudget,
    batchSize: o.batchSize,
    localFloor: o.localFloor,
  };
  try {
    const run = await scoreItems(items, opts);
    const platformId = items[0]?.platformId as IcPlatformId | undefined;
    logEvent({
      platformId,
      kind: "score",
      level: "info",
      message: `打分 ${items.length} 项 · ${run.cheapModel}${run.strongModel ? `+${run.strongModel}` : ""} · $${run.costUsd.toFixed(5)}`,
      meta: { count: items.length, costUsd: run.costUsd, cheapModel: run.cheapModel, strongModel: run.strongModel },
    });
    return NextResponse.json(run);
  } catch (e) {
    logEvent({ kind: "score", level: "error", message: `打分失败：${(e as Error).message}` });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
