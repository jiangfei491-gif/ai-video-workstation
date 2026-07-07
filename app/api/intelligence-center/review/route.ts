import { NextResponse } from "next/server";
import { enqueueScored, listReviewRecords, type EnqueueInput } from "@/app/lib/intelligence-center/review-queue/queue";
import type { IcReviewStatus } from "@/app/lib/intelligence-center/review-queue/store";
import { logEvent } from "@/app/lib/intelligence-center/event-log/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/intelligence-center/review?status=review —— 列出审核队列 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as IcReviewStatus | null;
  return NextResponse.json({ records: listReviewRecords(status ?? undefined) });
}

/**
 * POST /api/intelligence-center/review —— 把打分结果加入审核队列
 * body: { items: EnqueueInput[] }（EnqueueInput = 打分结果项：{item,score,module,worth,reason,tags,scoredBy}）
 */
export async function POST(req: Request) {
  let body: { items?: EnqueueInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "非法 JSON" }, { status: 400 });
  }
  const items = body.items ?? [];
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items 为空" }, { status: 400 });
  }
  const added = items
    .filter((i) => i?.item?.id)
    .map((i) =>
      enqueueScored({
        item: i.item,
        score: i.score ?? 0,
        module: i.module ?? "无",
        worth: Boolean(i.worth),
        reason: i.reason ?? "",
        tags: Array.isArray(i.tags) ? i.tags : [],
        scoredBy: i.scoredBy ?? "unknown",
      }),
    );
  if (added.length) {
    logEvent({
      platformId: added[0].platformId,
      kind: "enqueue",
      level: "info",
      message: `加入审核 ${added.length} 项`,
      meta: { count: added.length },
    });
  }
  return NextResponse.json({ added: added.length, records: added });
}
