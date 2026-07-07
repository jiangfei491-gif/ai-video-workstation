import { NextResponse } from "next/server";
import { buildEditInputFromWorkbench } from "@/app/lib/auto-edit";
import { alignScriptWithAi } from "@/app/lib/auto-edit/generate-script-align";
import { attachTimelineToScriptMap } from "@/app/lib/auto-edit/edit-graph/build-script-map";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { workbench: T2VWorkbenchState };
    const input = buildEditInputFromWorkbench(body.workbench);
    if (!input) {
      return NextResponse.json({ error: "请先运行编导生成分镜" }, { status: 400 });
    }

    const scriptMap = await alignScriptWithAi(input);
    const video = body.workbench.editGraph?.timeline.video ?? [];
    const withTime = attachTimelineToScriptMap(scriptMap, video);

    return NextResponse.json({ scriptMap: withTime });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
