import type {
  ProviderHealth,
  VoiceCenterProviderId,
  VoiceDirectorTask,
  VoiceCenterResult,
} from "../types";

export type ProviderSynthOutput = {
  filepath: string;
  url: string;
  relativePath: string;
  durationSec: number;
  voiceId: string;
  cost?: number;
  sentenceTimestamp?: import("../types").SentenceTimestamp[];
  wordTimestamp?: import("../types").WordTimestamp[];
};

export interface VoiceCenterProvider {
  id: VoiceCenterProviderId;
  label: string;
  kind: "local" | "cloud";
  healthCheck(): Promise<ProviderHealth>;
  synthesize(task: VoiceDirectorTask): Promise<ProviderSynthOutput>;
}

export function toVoiceCenterResult(
  task: VoiceDirectorTask,
  provider: VoiceCenterProviderId,
  out: ProviderSynthOutput,
  status: VoiceCenterResult["status"] = "success"
): VoiceCenterResult {
  return {
    taskId: task.id,
    status,
    audio: {
      filepath: out.filepath,
      url: out.url,
      relativePath: out.relativePath,
    },
    duration: out.durationSec,
    provider,
    voice: out.voiceId,
    sentenceTimestamp: out.sentenceTimestamp ?? [],
    wordTimestamp: out.wordTimestamp ?? [],
    cost: out.cost,
  };
}
