import { directorChatCompletion } from "@/app/lib/director/director-chat";
import { generateEditPlan } from "@/app/lib/auto-edit/generate-edit-plan";
import type { BuildEditInput, PacingProfile } from "@/app/lib/auto-edit/types";
import { editPlanToDirectorPlan } from "./adapters";
import type { DirectorPlan } from "./types";

const DIRECTOR_SYSTEM = `你是 AI 剪辑导演（大脑）。你只负责「决策」，不负责执行。

根据脚本、分镜与素材情况，输出 Director Plan JSON：
- 每镜用哪个素材（assetId 对应输入 clips[].key）
- 每镜时长 durationSec（0.5～120 秒）
- 镜与镜之间 transitionAfter（type + durationMs + rationale）
- 整体 pacingProfile、节奏说明 aiNotes
- 字幕策略：subtitles[] 与镜头对齐（text / startSec / durationSec / shotIndex）

禁止输出 track 编号、insertClip 等执行命令。

只返回 JSON：
{
  "clips": [
    {
      "id": "shot-0",
      "shotIndex": 0,
      "assetId": "shot-0",
      "label": "镜1",
      "startSec": 0,
      "durationSec": 4.5,
      "transitionAfter": { "type": "crossfade", "durationMs": 300, "rationale": "情绪过渡" },
      "rationale": "开场钩子",
      "tags": ["hook"]
    }
  ],
  "subtitles": [{ "id": "sub-0", "text": "...", "startSec": 0, "durationSec": 4.5, "shotIndex": 0 }],
  "pacingProfile": "documentary|viral|cinematic",
  "aiNotes": ["..."],
  "sectionPacing": { "sectionId": "开场慢" }
}`;

type AiDirectorResponse = {
  clips?: DirectorPlan["clips"];
  subtitles?: DirectorPlan["subtitles"];
  pacingProfile?: PacingProfile;
  aiNotes?: string[];
  sectionPacing?: Record<string, string>;
};

/**
 * AI 导演：workbench 输入 → Director Plan（大脑层）
 * 优先走专用 Director Prompt；失败时回退 EditPlan → DirectorPlan adapter。
 */
export async function generateDirectorPlan(
  input: BuildEditInput,
  title: string,
  basePacing: PacingProfile = "documentary"
): Promise<DirectorPlan> {
  const payload = {
    topic: input.topic,
    scriptExcerpt: (input.script ?? "").slice(0, 4000),
    clips: input.storyboard.map((s, shotIndex) => ({
      key: `shot-${shotIndex}`,
      shotIndex,
      durationSec: s.duration,
      narration: s.narration,
      action: s.action,
      hasVideo: !!input.batchResults[shotIndex]?.videoUrl,
      hasFrame: !!(input.shotFrames[shotIndex] ?? input.batchResults[shotIndex]?.firstFrameUrl),
    })),
    sections: input.sections.map((s) => ({ id: s.id, title: s.title })),
    narrativeEdges: input.narrativeEdges,
    pacingProfile: basePacing,
    fps: input.fps,
    aspectRatio: input.aspectRatio,
  };

  try {
    const { text, model, usage } = await directorChatCompletion(
      "edit-plan",
      DIRECTOR_SYSTEM,
      JSON.stringify(payload, null, 2),
      { json: true, maxTokens: 3000 }
    );
    const parsed = JSON.parse(text) as AiDirectorResponse;
    if (parsed.clips?.length) {
      return {
        version: 1,
        id: `plan-${Date.now()}`,
        title,
        createdAt: new Date().toISOString(),
        fps: input.fps,
        aspectRatio: input.aspectRatio,
        pacingProfile: parsed.pacingProfile ?? basePacing,
        clips: parsed.clips,
        subtitles: parsed.subtitles ?? [],
        meta: {
          aiNotes: parsed.aiNotes ?? [],
          sectionPacing: parsed.sectionPacing,
          model,
          usage,
        },
      };
    }
  } catch {
    /* fall through */
  }

  const editPlan = await generateEditPlan(input, basePacing);
  return editPlanToDirectorPlan(editPlan, input, title);
}
