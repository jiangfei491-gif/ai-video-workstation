/** 口播文本规范化，利于 TTS 断句与停顿 */
export function prepareTtsText(text: string): string {
  let out = text.trim().replace(/\s+/g, " ");

  // 统一中文标点
  out = out
    .replace(/,/g, "，")
    .replace(/;/g, "；")
    .replace(/\?/g, "？")
    .replace(/!/g, "！");

  // 逗号/分号后留空，多数 TTS 会自然停顿
  out = out.replace(/([，；])/g, "$1 ");

  return out.replace(/\s{2,}/g, " ").trim();
}

export const OPENAI_TTS_INSTRUCTIONS_ZH =
  "用自然、清晰的中文口语朗读口播稿，语速适中，在逗号和句号处自然停顿，像短视频解说。";
