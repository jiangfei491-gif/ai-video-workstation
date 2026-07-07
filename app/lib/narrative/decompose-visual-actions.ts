import type { NarrativeBeat } from "./types";
import type { SourceIntent, VisualActionUnit } from "./visual-action-types";
import {
  buildSourceIntent,
  classifySourceClause,
  visualizeAbstractClause,
  type VisualizeContext,
} from "./abstract-narrative-visualizer";

const CHAPTER_HEAD = /^第[一二三四五六七八九十\d]+章|^结尾$/;

/** 从 Beat 文本提取叙事过程（仅供分解输入，不直接生成 Shot） */
export function deriveBeatProcess(beat: NarrativeBeat): {
  beatGoal: string;
  actionProcess: string[];
  reactionProcess: string[];
  informationReveal: string;
} {
  const clauses = beat.sourceText
    .split(/[。！？；\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);

  const actionProcess: string[] = [];
  const reactionProcess: string[] = [];

  for (const c of clauses) {
    if (/震惊|沉默|眼神|表情|愣|呆|犹豫|动摇|信念|希望|绝望|光.*照进|忘不了|沉默片刻|担心/.test(c)) {
      reactionProcess.push(c);
    } else {
      actionProcess.push(c);
    }
  }

  const informationReveal =
    clauses.find(
      (c) =>
        /异常|斑点|免疫记忆|奇迹|无农药|有机|烂果|堆肥|印记/.test(c) && !CHAPTER_HEAD.test(c),
    ) ?? "";

  return {
    beatGoal: beat.beatGoal || beat.narrativePurpose,
    actionProcess,
    reactionProcess,
    informationReveal,
  };
}

function defaultProtagonist(beat: NarrativeBeat): string {
  return beat.characters[0] ?? "木村秋则";
}

function defaultLocation(beat: NarrativeBeat): string {
  const env = beat.environment?.trim();
  if (env && env !== "未指定") return env;
  return "果园";
}

function shortenRef(text: string, max = 48): string {
  const t = text.replace(/^[然而于是但而且]+[，,]?/, "").trim();
  return t.length <= max ? t : t.slice(0, max);
}

/** 从 Beat 源文提取可分解子句（保留 reaction 标记） */
function extractClauses(beat: NarrativeBeat): { clause: string; isReaction: boolean }[] {
  const out: { clause: string; isReaction: boolean }[] = [];
  const paragraphs = beat.sourceText.split(/\n+/).map((s) => s.trim()).filter(Boolean);

  for (const para of paragraphs) {
    if (CHAPTER_HEAD.test(para)) {
      out.push({ clause: para, isReaction: false });
      continue;
    }
    const parts = para
      .split(/[。！？]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    for (const p of parts) {
      const isReaction =
        /妻子.*动摇|担心.*生活|信念|光.*照进|忘不了|沉默|眼神|表情/.test(p) &&
        !/手动|铺设|观察|记录|清除|翻阅|关闭|卸下/.test(p);
      out.push({ clause: p, isReaction });
    }
  }
  return out;
}

function chapterEstablishUnit(
  beat: NarrativeBeat,
  clause: string,
  protagonist: string,
  location: string,
  seq: number,
): VisualActionUnit {
  const sourceRef = shortenRef(clause);
  const visible =
    location === "果园"
      ? "晨雾中的果园沿山坡展开"
      : `${location}在日光下清晰可见`;
  return {
    unitId: `${beat.beatId}_U${String(seq + 1).padStart(3, "0")}`,
    beatId: beat.beatId,
    subject: location,
    visibleAction: visible,
    location,
    visualFocus: visible.slice(0, 12),
    purpose: "establish",
    sourceRef,
    evidenceOf: sourceRef,
    sourceIntent: "ESTABLISH",
  };
}

function visualizeManualPestRemoval(ctx: VisualizeContext): import("./visual-action-types").VisualActionUnit[] {
  const p = ctx.protagonist;
  const ref = ctx.sourceRef;
  return [
    {
      unitId: `${ctx.beat.beatId}_U${String(ctx.unitSeqStart + 1).padStart(3, "0")}`,
      beatId: ctx.beat.beatId,
      subject: p,
      visibleAction: `${p}手指摘除叶上害虫`,
      object: "害虫",
      location: ctx.location,
      visualFocus: "手指与叶片",
      purpose: "action",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
    },
  ];
}

function visualizeReflectiveFilm(ctx: VisualizeContext): import("./visual-action-types").VisualActionUnit[] {
  const p = ctx.protagonist;
  const ref = ctx.sourceRef;
  return [
    {
      unitId: `${ctx.beat.beatId}_U${String(ctx.unitSeqStart + 1).padStart(3, "0")}`,
      beatId: ctx.beat.beatId,
      subject: p,
      visibleAction: `${p}展开反光膜铺在地面`,
      object: "反光膜",
      location: ctx.location,
      visualFocus: "薄膜铺设",
      purpose: "action",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
    },
  ];
}

function visualizeNotebookRecord(ctx: VisualizeContext): import("./visual-action-types").VisualActionUnit[] {
  const p = ctx.protagonist;
  const ref = ctx.sourceRef;
  return [
    {
      unitId: `${ctx.beat.beatId}_U${String(ctx.unitSeqStart + 1).padStart(3, "0")}`,
      beatId: ctx.beat.beatId,
      subject: p,
      visibleAction: `${p}翻开笔记本`,
      object: "笔记本",
      visualFocus: "手与笔记本",
      purpose: "action",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
    },
    {
      unitId: `${ctx.beat.beatId}_U${String(ctx.unitSeqStart + 2).padStart(3, "0")}`,
      beatId: ctx.beat.beatId,
      subject: p,
      visibleAction: `${p}笔尖在纸上移动`,
      object: "笔记本",
      visualFocus: "书写动作",
      purpose: "detail",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
    },
  ];
}

function visualizeObserveTrees(ctx: VisualizeContext): import("./visual-action-types").VisualActionUnit[] {
  const p = ctx.protagonist;
  const ref = ctx.sourceRef;
  return [
    {
      unitId: `${ctx.beat.beatId}_U${String(ctx.unitSeqStart + 1).padStart(3, "0")}`,
      beatId: ctx.beat.beatId,
      subject: p,
      visibleAction: `${p}凑近观察果实色泽`,
      object: "果实",
      location: ctx.location,
      visualFocus: "视线与果实",
      purpose: "action",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
    },
    {
      unitId: `${ctx.beat.beatId}_U${String(ctx.unitSeqStart + 2).padStart(3, "0")}`,
      beatId: ctx.beat.beatId,
      subject: p,
      visibleAction: `${p}触摸记录叶片纹理`,
      object: "叶片",
      visualFocus: "叶片纹理",
      purpose: "detail",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
    },
  ];
}

function visualizeResearchClause(ctx: VisualizeContext): import("./visual-action-types").VisualActionUnit[] {
  const p = ctx.protagonist;
  const ref = ctx.sourceRef;
  return [
    {
      unitId: `${ctx.beat.beatId}_U${String(ctx.unitSeqStart + 1).padStart(3, "0")}`,
      beatId: ctx.beat.beatId,
      subject: p,
      visibleAction: `${p}从桌边拿起农业资料册`,
      object: "农业资料",
      visualFocus: "拿起资料册",
      purpose: "action",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
    },
  ];
}

function splitClauseToMicro(clause: string): string[] {
  if (
    /传统农业|化学药剂|生态平衡|疯狂的决定|停止使用农药|免疫记忆|苹果树.*记忆/.test(clause)
  ) {
    return [clause];
  }
  if (clause.length < 20) return [clause];
  const parts = clause
    .split(/[，、]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
  if (parts.length > 1) return parts;
  return [clause];
}

function visualizeStandAndLook(ctx: VisualizeContext): import("./visual-action-types").VisualActionUnit[] {
  const p = ctx.protagonist;
  const ref = ctx.sourceRef;
  const base = ctx.unitSeqStart;
  const beatId = ctx.beat.beatId;
  const mk = (n: number, partial: Omit<import("./visual-action-types").VisualActionUnit, "unitId" | "beatId">) => ({
    unitId: `${beatId}_U${String(base + n).padStart(3, "0")}`,
    beatId,
    ...partial,
  });
  return [
    mk(1, {
      subject: p,
      visibleAction: `${p}站在果园树行中`,
      location: ctx.location,
      visualFocus: "站立身影",
      purpose: "action",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
    }),
    mk(2, {
      subject: p,
      visibleAction: `${p}目光落在枯黄叶片上`,
      object: "叶片",
      visualFocus: "枯黄叶片",
      purpose: "detail",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
    }),
    mk(3, {
      subject: p,
      visibleAction: `${p}握拳后抬头`,
      visualFocus: "抬头神情",
      purpose: "reaction",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
      reaction: { subject: p, visibleBehavior: `${p}目光坚定`, emotionIntent: "决心" },
    }),
  ];
}

function visualizeAppleTaste(ctx: VisualizeContext): import("./visual-action-types").VisualActionUnit[] {
  const p = ctx.protagonist;
  const ref = ctx.sourceRef;
  const base = ctx.unitSeqStart;
  const beatId = ctx.beat.beatId;
  const mk = (n: number, partial: Omit<import("./visual-action-types").VisualActionUnit, "unitId" | "beatId">) => ({
    unitId: `${beatId}_U${String(base + n).padStart(3, "0")}`,
    beatId,
    ...partial,
  });
  return [
    mk(1, {
      subject: p,
      visibleAction: `${p}伸手摘取枝头苹果`,
      object: "苹果",
      visualFocus: "摘取动作",
      purpose: "action",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
    }),
    mk(2, {
      subject: p,
      visibleAction: `${p}拇指擦过果面`,
      object: "苹果",
      visualFocus: "果皮反光",
      purpose: "detail",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
    }),
    mk(3, {
      subject: p,
      visibleAction: `${p}咬下苹果`,
      object: "苹果",
      visualFocus: "咬下瞬间",
      purpose: "action",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
    }),
    mk(4, {
      subject: p,
      visibleAction: `${p}咀嚼后微微睁眼`,
      visualFocus: "品味表情",
      purpose: "reaction",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
      reaction: { subject: p, visibleBehavior: `${p}嘴角放松`, emotionIntent: "惊喜" },
    }),
  ];
}

function visualizeTasteDescription(ctx: VisualizeContext): import("./visual-action-types").VisualActionUnit[] {
  const p = ctx.protagonist;
  const ref = ctx.sourceRef;
  return [
    {
      unitId: `${ctx.beat.beatId}_U${String(ctx.unitSeqStart + 1).padStart(3, "0")}`,
      beatId: ctx.beat.beatId,
      subject: p,
      visibleAction: `${p}咀嚼苹果后停顿`,
      object: "苹果",
      visualFocus: "面部微表情",
      purpose: "reaction",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "CONCRETE_ACTION",
      reaction: { subject: p, visibleBehavior: `${p}缓缓点头`, emotionIntent: "认可" },
    },
  ];
}

function visualizeTreeMemoryResearch(ctx: VisualizeContext): import("./visual-action-types").VisualActionUnit[] {
  const p = ctx.protagonist;
  const ref = ctx.sourceRef;
  const base = ctx.unitSeqStart;
  const beatId = ctx.beat.beatId;
  const mk = (n: number, partial: Omit<import("./visual-action-types").VisualActionUnit, "unitId" | "beatId">) => ({
    unitId: `${beatId}_U${String(base + n).padStart(3, "0")}`,
    beatId,
    ...partial,
  });
  return [
    mk(1, {
      subject: p,
      visibleAction: `${p}蹲在树旁翻看笔记`,
      object: "笔记",
      visualFocus: "笔记与树干",
      purpose: "action",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "REALIZATION",
    }),
    mk(2, {
      subject: p,
      visibleAction: `${p}手掌贴上树皮`,
      object: "树皮",
      visualFocus: "手掌与树皮",
      purpose: "detail",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "REALIZATION",
    }),
    mk(3, {
      subject: p,
      visibleAction: `${p}在笔记上勾画树形`,
      object: "笔记",
      visualFocus: "勾画动作",
      purpose: "detail",
      sourceRef: ref,
      evidenceOf: ref,
      sourceIntent: "REALIZATION",
    }),
  ];
}

function isNarrationOnly(clause: string): boolean {
  return /你有没有想过|今天[，,]?我们要讲|感谢收看|不妨想一想|可以改变.*村庄的命运|日本青森县木村家|这个故事/.test(
    clause.trim(),
  );
}

function clauseToUnits(
  clause: string,
  beat: NarrativeBeat,
  protagonist: string,
  location: string,
  seqStart: number,
  forceReaction?: boolean,
): VisualActionUnit[] {
  if (isNarrationOnly(clause)) return [];

  const sourceRef = shortenRef(clause);
  const ctx: VisualizeContext = {
    beat,
    sourceRef,
    clause,
    protagonist,
    location,
    unitSeqStart: seqStart,
  };

  if (CHAPTER_HEAD.test(clause.trim())) {
    return [chapterEstablishUnit(beat, clause, protagonist, location, seqStart)];
  }
  if (/查阅资料|开始查阅/.test(clause) && !/发现|生态|药剂/.test(clause)) {
    return visualizeResearchClause(ctx);
  }
  if (/手动清除害虫|清除害虫/.test(clause)) {
    return visualizeManualPestRemoval(ctx);
  }
  if (/反光膜|铺设/.test(clause)) {
    return visualizeReflectiveFilm(ctx);
  }
  if (/笔记本|记录每一天/.test(clause)) {
    return visualizeNotebookRecord(ctx);
  }
  if (/观察.*树|记录.*纹理|果实的颜色/.test(clause)) {
    return visualizeObserveTrees(ctx);
  }
  if (/站在.*看着|看着枯黄/.test(clause)) {
    return visualizeStandAndLook(ctx);
  }
  if (/摘下.*擦拭|擦拭.*咬|咬了一口/.test(clause)) {
    return visualizeAppleTaste(ctx);
  }
  if (/尝到.*清脆|甘甜|阳光气息/.test(clause)) {
    return visualizeTasteDescription(ctx);
  }
  if (/研究.*记忆|苹果树.*记忆/.test(clause)) {
    return visualizeTreeMemoryResearch(ctx);
  }

  if (/斑点病|斑点/.test(clause)) {
    return [
      {
        unitId: `${ctx.beat.beatId}_U${String(ctx.unitSeqStart + 1).padStart(3, "0")}`,
        beatId: ctx.beat.beatId,
        subject: "叶片",
        visibleAction: "叶片斑点清晰可见",
        object: "叶片",
        visualFocus: "叶片纹理",
        purpose: "reveal",
        sourceRef,
        evidenceOf: sourceRef,
        sourceIntent: "CONCRETE_ACTION",
      },
    ];
  }
  if (/落满一地|落满/.test(clause)) {
    return [
      {
        unitId: `${ctx.beat.beatId}_U${String(ctx.unitSeqStart + 1).padStart(3, "0")}`,
        beatId: ctx.beat.beatId,
        subject: "地面",
        visibleAction: "地面散落未熟果实",
        object: "果实",
        visualFocus: "地面与果实",
        purpose: "detail",
        sourceRef,
        evidenceOf: sourceRef,
        sourceIntent: "CONCRETE_ACTION",
      },
    ];
  }
  if (/村民.*惩罚|老天爷/.test(clause)) {
    return visualizeAbstractClause(ctx, {
      category: "social_pressure",
      intentCode: "SOCIAL_PRESSURE",
      description: "村民议论",
    });
  }
  if (/不相信/.test(clause)) {
    return [
      {
        unitId: `${ctx.beat.beatId}_U${String(ctx.unitSeqStart + 1).padStart(3, "0")}`,
        beatId: ctx.beat.beatId,
        subject: ctx.protagonist,
        visibleAction: `${ctx.protagonist}摇头后抬头`,
        visualFocus: "头部动作",
        purpose: "reaction",
        sourceRef,
        evidenceOf: sourceRef,
        sourceIntent: "CONCRETE_ACTION",
        reaction: {
          subject: ctx.protagonist,
          visibleBehavior: `${ctx.protagonist}目光不服`,
          emotionIntent: "不服",
        },
      },
    ];
  }

  const micro = splitClauseToMicro(clause);
  if (micro.length > 1) {
    let all: VisualActionUnit[] = [];
    let seq = seqStart;
    for (const part of micro) {
      const sub = clauseToUnits(part, beat, protagonist, location, seq, forceReaction);
      all = all.concat(sub);
      seq += sub.length;
    }
    return all;
  }

  const classification = classifySourceClause(clause);
  let units = visualizeAbstractClause(ctx, classification);

  if (forceReaction) {
    units = units.map((u) => ({
      ...u,
      purpose: u.purpose === "establish" ? ("establish" as const) : ("reaction" as const),
    }));
  }

  return units;
}

function focusSpatialLevel(unit: VisualActionUnit): string {
  const text = `${unit.location ?? ""} ${unit.visibleAction} ${unit.visualFocus}`;
  if (/仓库|家中|餐桌/.test(text)) return "interior";
  if (/篱笆|树行|内部/.test(text)) return "mid";
  if (/山坡|全景|展开/.test(text)) return "wide";
  return unit.location ?? "default";
}

/** 连续 establish 去重：无新空间信息则合并 */
export function dedupeEstablishUnits(units: VisualActionUnit[]): VisualActionUnit[] {
  const out: VisualActionUnit[] = [];
  for (const u of units) {
    if (u.purpose !== "establish") {
      out.push(u);
      continue;
    }
    const prev = [...out].reverse().find((x) => x.purpose === "establish");
    if (!prev) {
      out.push(u);
      continue;
    }
    const sameLoc = (prev.location ?? "") === (u.location ?? "") && prev.location !== undefined;
    const sameLevel = focusSpatialLevel(prev) === focusSpatialLevel(u);
    const sameFocus = prev.visualFocus === u.visualFocus;
    if (sameLoc && sameLevel && sameFocus) continue;
    if (
      sameLoc &&
      sameLevel &&
      /呈现|空间|全景/.test(prev.visibleAction) &&
      /呈现|空间|全景/.test(u.visibleAction)
    ) {
      continue;
    }
    out.push(u);
  }
  return out;
}

function dedupeAdjacentUnits(units: VisualActionUnit[]): VisualActionUnit[] {
  const out: VisualActionUnit[] = [];
  for (const u of units) {
    const last = out[out.length - 1];
    if (
      last &&
      last.visibleAction === u.visibleAction &&
      last.subject === u.subject &&
      last.purpose === u.purpose &&
      last.evidenceOf === u.evidenceOf
    ) {
      continue;
    }
    out.push(u);
  }
  return out;
}

export type DecomposeResult = {
  units: VisualActionUnit[];
  sourceIntents: SourceIntent[];
};

/** 规则路径：Beat → VisualActionUnit[] + sourceIntent 覆盖表 */
export function decomposeVisualActionsRule(
  beat: NarrativeBeat,
  _process?: ReturnType<typeof deriveBeatProcess>,
): DecomposeResult {
  const protagonist = defaultProtagonist(beat);
  const location = defaultLocation(beat);
  const clauses = extractClauses(beat);
  const allUnits: VisualActionUnit[] = [];
  const sourceIntents: SourceIntent[] = [];
  let seq = 0;

  for (const { clause, isReaction } of clauses) {
    const sourceRef = shortenRef(clause);
    sourceIntents.push(buildSourceIntent(sourceRef, clause));
    const units = clauseToUnits(clause, beat, protagonist, location, seq, isReaction);
    allUnits.push(...units);
    seq += units.length;
  }

  const units = dedupeAdjacentUnits(dedupeEstablishUnits(allUnits));

  if (!units.length) {
    units.push(
      chapterEstablishUnit(beat, beat.beatGoal || "开篇", protagonist, location, 0),
    );
  }

  return { units, sourceIntents };
}

export function visualProgressionFromUnits(units: VisualActionUnit[]): string[] {
  return units.map((u) => u.visualFocus).filter((v, i, a) => v && a.indexOf(v) === i);
}

export function enrichBeatWithProcess(
  beat: NarrativeBeat,
  process: ReturnType<typeof deriveBeatProcess>,
  units: VisualActionUnit[],
): NarrativeBeat {
  return {
    ...beat,
    beatGoal: process.beatGoal,
    actionProcess: process.actionProcess,
    reactionProcess: process.reactionProcess,
    informationReveal: process.informationReveal,
    visualProgression: visualProgressionFromUnits(units),
  };
}
