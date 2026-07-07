import type { VoiceDirectorTask } from "./types";
import type { ProviderSynthOutput } from "./providers/types";

/** 后处理占位：降噪 / 均衡 / 标准化（第一版透传） */
export async function postProcessVoice(
  task: VoiceDirectorTask,
  output: ProviderSynthOutput
): Promise<ProviderSynthOutput> {
  void task;
  return output;
}
