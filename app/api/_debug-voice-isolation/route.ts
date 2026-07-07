import { NextResponse } from "next/server";
import { ensureVoiceClips } from "@/app/lib/auto-edit/audio/ensure-voice-clips";
import type { EditTimeline, MediaPoolItem } from "@/app/lib/auto-edit/edit-graph/types";

export const runtime = "nodejs";

/** 临时调试路由：验证单镜头配音失败不再拖垮整批（用后即删） */
export async function GET() {
  const shots = [0, 1, 2];
  const timeline: EditTimeline = {
    fps: 30,
    aspectRatio: "9:16",
    durationSec: 30,
    video: [],
    music: [],
    subtitle: [],
    transitions: [],
    voice: shots.map((i) => ({
      id: `voice-${i}`,
      track: "voice",
      startSec: i * 5,
      durationSec: 5,
      sourceKey: `narr-${i}`,
      mediaRefId: `voice-script-${i}`,
      label: `隔离测试镜 ${i + 1}`,
      audio: { volume: 1 },
    })),
  };
  const mediaPool: MediaPoolItem[] = shots.map((i) => ({
    id: `voice-script-${i}`,
    kind: "voice",
    label: `隔离测试镜 ${i + 1}`,
    text: `这是隔离测试第 ${i + 1} 条口播文本。`,
    shotIndex: i,
    origin: "tts",
    status: "pending",
  }));

  const attempted: number[] = [];
  const result = await ensureVoiceClips({
    timeline,
    mediaPool,
    voiceProvider: "azure-tts", // 未配置 AZURE_SPEECH_KEY，必然抛错
    onClip: (shotIndex) => attempted.push(shotIndex),
  });

  return NextResponse.json({
    attempted,
    synthesized: result.synthesized,
    failed: result.failed,
    poolStatuses: result.mediaPool.map((p) => ({ id: p.id, status: p.status })),
  });
}
