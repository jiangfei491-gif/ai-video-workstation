import { resolveHistorySeed } from "@/app/lib/generation-params";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import type { VideoHistoryEntry } from "@/app/lib/history/types";
import { upsertVideoHistory, getVideoHistoryById } from "@/app/lib/history/video-store";
import { saveBlob, urlToBlobId } from "@/app/lib/history/blob-store";

export async function syncVideoHistoryFromWorkbench(
  state: T2VWorkbenchState,
  opts?: { status?: VideoHistoryEntry["status"] }
): Promise<string> {
  if (!state.director) return state.historyEntryId ?? "";

  const id = state.historyEntryId ?? crypto.randomUUID();

  let previewBlobId: string | null = null;
  let prodBlobId: string | null = null;
  let thumbBlobId = "";

  const previewUrl = state.testResult?.videoUrl;
  const prodUrl = state.prodResult;

  if (previewUrl) {
    previewBlobId = await urlToBlobId(previewUrl, "veo-preview");
    if (previewBlobId && !thumbBlobId) thumbBlobId = previewBlobId;
  }
  if (prodUrl) {
    prodBlobId = await urlToBlobId(prodUrl, "veo-prod");
    if (prodBlobId) thumbBlobId = prodBlobId;
  }

  if (!thumbBlobId) {
    thumbBlobId = `placeholder-${id}`;
    await saveBlob(thumbBlobId, new Blob([""], { type: "text/plain" }));
  }

  const existingShots = getVideoHistoryById(id)?.shots ?? [];

  const shots = state.director.prompts.map((p, i) => {
    const prev = existingShots[i];
    const isActive = i === state.activeShotIdx;
    return {
      sceneNumber: p.sceneNumber,
      providerPrompt: p.providerPrompt,
      veoPreviewBlobId: isActive ? previewBlobId : prev?.veoPreviewBlobId ?? null,
      veoProductionBlobId: isActive ? prodBlobId : prev?.veoProductionBlobId ?? null,
      veoPreviewUrl:
        (isActive && previewUrl?.startsWith("/api/") ? previewUrl : prev?.veoPreviewUrl) ??
        null,
      veoProductionUrl:
        (isActive && prodUrl?.startsWith("/api/") ? prodUrl : prev?.veoProductionUrl) ??
        null,
    };
  });

  const entry: VideoHistoryEntry = {
    id,
    createdAt: new Date().toISOString(),
    topic: state.topic,
    thumbnailBlobId: thumbBlobId,
    script: state.director.script,
    director: state.director,
    storyboard: state.director.storyboard,
    shotParams: {
      shotCount: state.shotCount,
      shotDurationSec: state.shotDurationSec,
      fps: state.fps,
      aspectRatio: state.aspectRatio,
      clarity: state.clarity,
      workspaceMode: state.workspaceMode,
      characterConsistency: state.characterConsistency,
      sceneConsistency: state.sceneConsistency,
      seedMode: state.seedMode,
      seed: resolveHistorySeed(
        state.seedMode,
        state.seed,
        state.testResult?.seed ?? null
      ),
    },
    status: opts?.status ?? (state.prodResult ? "completed" : state.testResult ? "running" : "running"),
    export: state.export,
    shots,
  };

  upsertVideoHistory(entry);
  return id;
}
