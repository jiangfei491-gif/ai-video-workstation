import type { VoiceCenterProviderId, VoiceDirectorTask } from "./types";
import {
  DEFAULT_LOCAL_CHAIN,
  ULTRA_CLOUD_CHAIN,
  sortedProviders,
} from "./registry";

/**
 * 根据导演任务机械选择引擎链（不做内容/风格推断）。
 */
export function resolveProviderChain(task: VoiceDirectorTask): VoiceCenterProviderId[] {
  if (task.provider) {
    return [task.provider];
  }

  if (task.renderExport) {
    return resolveRenderExportChain();
  }

  if (task.preferLocal || task.budget === "low") {
    return sortedProviders(DEFAULT_LOCAL_CHAIN);
  }

  const local = sortedProviders(DEFAULT_LOCAL_CHAIN);

  if (task.ultraQuality || task.quality === "ultra" || task.budget === "high") {
    return [...local, ...sortedProviders(ULTRA_CLOUD_CHAIN)];
  }

  if (task.quality === "high") {
    return sortedProviders(["fish-speech", "f5-tts", "cosyvoice"]);
  }

  return local;
}

/** 成片渲染：云端优先，本地仅作兜底（避免 fish-speech 404 等拖垮进度） */
function resolveRenderExportChain(): VoiceCenterProviderId[] {
  const primary: VoiceCenterProviderId[] = ["edge-tts", "elevenlabs"];
  if (process.env.OPENAI_API_KEY?.trim()) primary.push("openai-audio");
  const local = sortedProviders(DEFAULT_LOCAL_CHAIN).filter((id) => !primary.includes(id));
  return sortedProviders([...primary, ...local]);
}
