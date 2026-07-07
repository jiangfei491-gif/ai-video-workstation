import type { SubtitleCenterLanguage } from "../types";
import { translateSubtitleClips } from "@/app/lib/auto-edit/engines/localization/translate-subtitles";
import type { TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";
import type { SubtitleLanguage } from "@/app/lib/auto-edit/engines/types";

const SUPPORTED: SubtitleCenterLanguage[] = [
  "zh",
  "en",
  "vi",
  "ja",
  "ko",
  "es",
  "fr",
  "de",
  "ru",
];

export function listSubtitleLanguages(): { id: SubtitleCenterLanguage; label: string; supported: boolean }[] {
  const labels: Record<SubtitleCenterLanguage, string> = {
    zh: "中文",
    en: "English",
    vi: "Tiếng Việt",
    ja: "日本語",
    ko: "한국어",
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    ru: "Русский",
  };
  const engineLangs: SubtitleLanguage[] = ["zh", "en", "vi", "ja", "ko"];
  return SUPPORTED.map((id) => ({
    id,
    label: labels[id],
    supported: engineLangs.includes(id as SubtitleLanguage),
  }));
}

/** Language Engine — 多语言翻译由 AI 导演编排，实际调用 GPT-4.1（translate-subtitles） */
export async function translateSubtitleTrack(
  clips: TimelineClip[],
  targetLang: SubtitleCenterLanguage
): Promise<Record<string, string>> {
  const engineLangs: SubtitleLanguage[] = ["zh", "en", "vi", "ja", "ko"];
  if (!engineLangs.includes(targetLang as SubtitleLanguage)) {
    throw new Error(`语言 ${targetLang} 翻译即将支持，当前请使用 zh/en/vi/ja/ko`);
  }
  return translateSubtitleClips(clips, targetLang as SubtitleLanguage);
}
