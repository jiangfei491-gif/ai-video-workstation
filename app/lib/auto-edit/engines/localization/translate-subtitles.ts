import { directorChatCompletion } from "@/app/lib/director/director-chat";
import type { TimelineClip } from "../../edit-graph/types";
import type { SubtitleLanguage } from "../types";
import { applyGlossary, type Glossary } from "./index";

const LANG_LABEL: Record<SubtitleLanguage, string> = {
  zh: "简体中文",
  en: "English",
  vi: "Tiếng Việt",
  ja: "日本語",
  ko: "한국어",
};

type TranslateResponse = { lines?: { id: string; text: string }[] };

/** GPT 翻译字幕轨，返回 clipId → 译文 */
export async function translateSubtitleClips(
  clips: TimelineClip[],
  targetLang: SubtitleLanguage,
  glossary?: Glossary
): Promise<Record<string, string>> {
  const items = clips
    .filter((c) => c.subtitle?.text?.trim())
    .map((c) => ({ id: c.id, text: c.subtitle!.text.trim() }));

  if (items.length === 0) return {};

  const system = `你是专业字幕翻译。将中文字幕翻译为${LANG_LABEL[targetLang] ?? targetLang}。
保持短句、口语化、适合烧录。只返回 JSON：
{ "lines": [ { "id": "clip-id", "text": "译文" } ] }`;

  try {
    const { text } = await directorChatCompletion(
      "edit-plan",
      system,
      JSON.stringify({ lines: items }, null, 2),
      { json: true, maxTokens: 4000 }
    );
    const parsed = JSON.parse(text) as TranslateResponse;
    const out: Record<string, string> = {};
    for (const row of parsed.lines ?? []) {
      if (!row.id || !row.text?.trim()) continue;
      let translated = row.text.trim();
      if (glossary) translated = applyGlossary(translated, glossary, targetLang);
      out[row.id] = translated;
    }
    return out;
  } catch {
    return {};
  }
}
