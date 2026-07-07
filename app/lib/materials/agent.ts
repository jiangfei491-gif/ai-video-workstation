import {
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_ALL,
  MATERIAL_LANGUAGES,
  MATERIAL_SEARCH_LANGUAGE_ALL,
  getMaterialLanguageLabel,
  type MaterialSearchLanguage,
  type MaterialSearchProviderChoice,
} from "./types";
import {
  type MaterialSearchOutcome,
  type MaterialSearchProviderId,
  type FoundMaterial,
  runMaterialSearch,
} from "./material-search-providers";

export type { FoundMaterial, MaterialSearchProviderId, MaterialSearchOutcome };

const SEARCH_SOURCE_HINTS: Partial<
  Record<import("./types").MaterialLanguage, string>
> = {
  zh: "维基百科中文版、正规中文媒体、知乎高赞帖、知名中文博客",
  en: "Reddit, Wikipedia EN, BBC, NYT, The Guardian, reputable English blogs and forums",
  ja: "Wikipedia 日本語版、NHK、朝日新闻、はてな、ニコニコ、知名日文博客",
  ko: "Wikipedia 한국어, 네이버 뉴스, 디시인사이드, reputable Korean media",
  es: "Wikipedia en español, El País, BBC Mundo, reputable Spanish sources",
  de: "Wikipedia DE, Der Spiegel, reputable German media",
  fr: "Wikipedia FR, Le Monde, reputable French media",
  pt: "Wikipedia PT, reputable Portuguese and Brazilian media",
  ru: "Wikipedia RU, reputable Russian media",
  ar: "Wikipedia AR, Al Jazeera Arabic, reputable Arabic media",
};

function buildAgentInstruction(params: {
  task: string;
  count: number;
  category: string;
  language: MaterialSearchLanguage;
}): string {
  const categoryLine =
    params.category === MATERIAL_CATEGORY_ALL
      ? `【类别】不限单一分类。从 ${MATERIAL_CATEGORIES.join("、")} 等方向挑选最契合任务的内容，每篇素材尽量覆盖不同类别。`
      : `类别倾向：${params.category}`;

  const categoryField =
    params.category === MATERIAL_CATEGORY_ALL
      ? `\n- category：最匹配的入库分类，取值必须是 ${MATERIAL_CATEGORIES.join("|")} 之一`
      : "";

  let searchRules: string;
  let outputRules: string;
  let languageField = "";

  if (params.language === MATERIAL_SEARCH_LANGUAGE_ALL) {
    const langLabels = MATERIAL_LANGUAGES.map((l) => l.label).join("、");
    searchRules = `【多语种】不限单一语言。从 ${langLabels} 等母语互联网广泛检索，共找 ${params.count} 篇，尽量覆盖多种语言来源；每种语言至少尝试检索，禁止只搜中文二手转载。`;
    outputRules = `- title：中文标题（外文素材需忠实翻译）
- content：用中文概述该素材 300-500 字，覆盖人物、冲突、转折、结局；禁止在 content 中保留大段外文原文`;
    languageField = `\n- language：原文语种代码，取值必须是 ${MATERIAL_LANGUAGES.map((l) => l.id).join("|")}`;
  } else {
    const langLabel = getMaterialLanguageLabel(params.language);
    const sourceHint =
      SEARCH_SOURCE_HINTS[params.language] ??
      `该语言（${langLabel}）地区的权威媒体、维基百科对应语言版、高赞论坛帖`;

    searchRules =
      params.language === "zh"
        ? `用中文关键词搜索，优先中文权威来源（${sourceHint}）。`
        : `【检索语言】${langLabel}。必须用${langLabel}撰写搜索关键词，在${langLabel}母语互联网检索；优先${sourceHint}。必须找到该语言地区的原始报道或讨论，禁止只搜中文翻译版或中文二手转载。`;

    outputRules =
      params.language === "zh"
        ? `- title：中文标题
- content：用中文概述该素材 300-500 字，覆盖人物、冲突、转折、结局`
        : `- title：中文标题（忠实翻译原文标题，素材库统一中文展示）
- content：用中文概述该素材 300-500 字（忠实翻译/概括${langLabel}原文，覆盖人物、冲突、转折、结局；禁止在 content 中保留大段外文原文）`;
  }

  const langNote =
    params.language === MATERIAL_SEARCH_LANGUAGE_ALL
      ? "素材库统一用中文显示标题与正文；多语种来源需在 language 字段标注原文语种。"
      : params.language === "zh"
        ? "素材库统一用中文显示标题与正文。本篇为中文素材。"
        : `素材库统一用中文显示标题与正文。本篇原文为${getMaterialLanguageLabel(params.language)}，但 title 与 content 必须全部用中文撰写。`;

  return `你是短视频选题猎手。使用联网搜索，去全网找 ${params.count} 篇真实、可考证、适合做短视频的素材。

【入库展示】${langNote}

任务：${params.task}
${categoryLine}

筛选标准：要有故事性（人物 / 冲突 / 转折 / 结局）。${searchRules}

对每一篇输出：
${outputRules}
- sourceUrl：真实可访问的网址（优先原文页面，非机器翻译页）
- sourceSite：来源站点名${categoryField}${languageField}

只返回一个 JSON 数组，不要任何解释、不要代码块标记：
[{"title":"","sourceUrl":"","sourceSite":"","content":""}]`;
}

/**
 * 素材 Agent —— GPT 联网搜索优先，失败则 Gemini Google 搜索兜底。
 */
export async function findMaterials(params: {
  task: string;
  count: number;
  category: string;
  language: MaterialSearchLanguage;
  searchProvider?: MaterialSearchProviderChoice;
}): Promise<MaterialSearchOutcome> {
  const count = Math.max(1, Math.min(20, Math.floor(params.count) || 5));
  const instruction = buildAgentInstruction({ ...params, count });
  return runMaterialSearch(instruction, count, params.searchProvider ?? "all");
}
