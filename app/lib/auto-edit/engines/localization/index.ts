import type { SubtitleLanguage } from "../types";

export type GlossaryEntry = {
  term: string;
  translations: Partial<Record<SubtitleLanguage, string>>;
  doNotTranslate?: boolean;
};

export type Glossary = {
  id: string;
  name: string;
  entries: GlossaryEntry[];
  updatedAt: string;
};

const STORAGE_KEY = "workbench:glossary";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function loadGlossary(): Glossary {
  if (!canUseStorage()) {
    return { id: "default", name: "默认术语库", entries: [], updatedAt: new Date().toISOString() };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Glossary;
  } catch {
    /* ignore */
  }
  return {
    id: "default",
    name: "默认术语库",
    entries: [
      { term: "OpenAI", doNotTranslate: true, translations: {} },
      { term: "Veo", doNotTranslate: true, translations: {} },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function saveGlossary(g: Glossary): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...g, updatedAt: new Date().toISOString() }));
  } catch {
    /* ignore */
  }
}

export function applyGlossary(text: string, glossary: Glossary, lang: SubtitleLanguage): string {
  let out = text;
  for (const e of glossary.entries) {
    if (e.doNotTranslate) continue;
    const repl = e.translations[lang];
    if (repl) out = out.split(e.term).join(repl);
  }
  return out;
}

export type FontProfile = {
  lang: SubtitleLanguage;
  fontname: string;
  fontsize: number;
  marginV: number;
};

export const FONT_PROFILES: FontProfile[] = [
  { lang: "zh", fontname: "PingFang SC", fontsize: 42, marginV: 60 },
  { lang: "en", fontname: "Helvetica Neue", fontsize: 38, marginV: 56 },
  { lang: "vi", fontname: "Arial", fontsize: 38, marginV: 56 },
  { lang: "ja", fontname: "Hiragino Sans", fontsize: 40, marginV: 58 },
  { lang: "ko", fontname: "Apple SD Gothic Neo", fontsize: 40, marginV: 58 },
];

export function fontProfileFor(lang: SubtitleLanguage): FontProfile {
  return FONT_PROFILES.find((f) => f.lang === lang) ?? FONT_PROFILES[0];
}

export const UI_LANGUAGES = [
  { id: "zh", label: "中文" },
  { id: "en", label: "English" },
  { id: "vi", label: "Tiếng Việt" },
  { id: "ja", label: "日本語" },
  { id: "ko", label: "한국어" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "pt", label: "Português" },
  { id: "ru", label: "Русский" },
  { id: "th", label: "ภาษาไทย" },
  { id: "id", label: "Bahasa Indonesia" },
] as const;

export type UiLangId = (typeof UI_LANGUAGES)[number]["id"];

const MESSAGES: Record<UiLangId, Record<string, string>> = {
  zh: {
    editCenter: "AI 剪辑中心",
    render: "渲染成片",
    exportSrt: "导出 SRT",
    aiDecision: "AI 剪辑决策",
    storyGraph: "故事图谱",
    engines: "渲染引擎",
  },
  en: {
    editCenter: "AI Edit Center",
    render: "Render",
    exportSrt: "Export SRT",
    aiDecision: "AI Decisions",
    storyGraph: "Story Graph",
    engines: "Render Engine",
  },
  vi: { editCenter: "Trung tâm AI", render: "Xuất bản", exportSrt: "Xuất SRT", aiDecision: "AI", storyGraph: "Story Graph", engines: "Engine" },
  ja: { editCenter: "AI編集", render: "レンダー", exportSrt: "SRT出力", aiDecision: "AI判断", storyGraph: "Story Graph", engines: "Engine" },
  ko: { editCenter: "AI 편집", render: "렌더", exportSrt: "SRT 내보내기", aiDecision: "AI 결정", storyGraph: "Story Graph", engines: "Engine" },
  es: { editCenter: "Centro AI", render: "Renderizar", exportSrt: "Exportar SRT", aiDecision: "AI", storyGraph: "Story Graph", engines: "Engine" },
  fr: { editCenter: "Centre AI", render: "Rendu", exportSrt: "Exporter SRT", aiDecision: "AI", storyGraph: "Story Graph", engines: "Engine" },
  de: { editCenter: "AI Schnitt", render: "Rendern", exportSrt: "SRT export", aiDecision: "AI", storyGraph: "Story Graph", engines: "Engine" },
  pt: { editCenter: "Centro AI", render: "Renderizar", exportSrt: "Exportar SRT", aiDecision: "AI", storyGraph: "Story Graph", engines: "Engine" },
  ru: { editCenter: "AI монтаж", render: "Рендер", exportSrt: "SRT", aiDecision: "AI", storyGraph: "Story Graph", engines: "Engine" },
  th: { editCenter: "AI ตัดต่อ", render: "เรนเดอร์", exportSrt: "SRT", aiDecision: "AI", storyGraph: "Story Graph", engines: "Engine" },
  id: { editCenter: "Pusat AI", render: "Render", exportSrt: "Ekspor SRT", aiDecision: "AI", storyGraph: "Story Graph", engines: "Engine" },
};

export function tUi(lang: UiLangId, key: string): string {
  return MESSAGES[lang]?.[key] ?? MESSAGES.zh[key] ?? key;
}
