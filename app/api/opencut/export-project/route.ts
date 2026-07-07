import { NextResponse } from "next/server";
import { refreshEditGraphFromWorkbench } from "@/app/lib/auto-edit/edit-graph/refresh-graph";
import { editGraphToOpenCutProject } from "@/app/lib/opencut/project-bridge";
import { editGraphToTimelineSpec } from "@/app/lib/opencut/timeline-spec-bridge";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

export const runtime = "nodejs";

/** 导出 AI 工程为 OpenCut 可消费的 JSON（程序接口，非 UI 自动化） */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { workbench: T2VWorkbenchState };
    const graph = refreshEditGraphFromWorkbench(body.workbench);
    if (!graph) {
      return NextResponse.json({ error: "请先完成 AI 编导并运行「一键 AI 剪辑」" }, { status: 400 });
    }

    const name =
      body.workbench.director?.title?.trim().replace(/\s+/g, "-") || "ai-workstation-project";
    const openCutProject = editGraphToOpenCutProject(graph, name);
    const timelineSpec = editGraphToTimelineSpec(graph, name, {
      bgmUrl: body.workbench.editBgmUrl,
      bgmVolume: body.workbench.editBgmVolume,
      coverImage: body.workbench.editCoverImageUrl,
    });

    const project = {
      format: "ai-video-workstation/opencut-bridge",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      timelineSpec,
      openCutProject,
    };

    return NextResponse.json({
      filename: `${name}-opencut.json`,
      project,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
