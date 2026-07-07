import { synthesizeVoiceToDesktop } from "../../../audio/synthesize-voice";
import type { VoiceProvider } from "../types";

export const edgeTtsProvider: VoiceProvider = {
  id: "edge-tts",
  label: "Edge TTS（本地）",
  available: () => true,
    async synthesize(params) {
    const result = await synthesizeVoiceToDesktop({
      text: params.text,
      shotIndex: params.shotIndex,
      voiceId: params.voiceId,
    });
    return {
      filepath: result.filepath,
      durationSec: result.durationSec,
      provider: "edge-tts",
    };
  },
};
