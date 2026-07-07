import type {
  AbstractNarrativeCategory,
  SourceIntent,
  VisualActionUnit,
} from "./visual-action-types";
import type { NarrativeBeat } from "./types";

export type VisualizeContext = {
  beat: NarrativeBeat;
  sourceRef: string;
  clause: string;
  protagonist: string;
  location: string;
  unitSeqStart: number;
};

type DraftUnit = Omit<VisualActionUnit, "unitId">;

function draft(
  ctx: VisualizeContext,
  partial: Omit<DraftUnit, "sourceRef" | "beatId">,
): DraftUnit {
  return {
    beatId: ctx.beat.beatId,
    sourceRef: ctx.sourceRef,
    ...partial,
  };
}

function finalizeDrafts(ctx: VisualizeContext, drafts: DraftUnit[]): VisualActionUnit[] {
  return drafts.map((d, i) => ({
    ...d,
    unitId: `${ctx.beat.beatId}_U${String(ctx.unitSeqStart + i + 1).padStart(3, "0")}`,
  }));
}

/** 识别抽象叙事并返回 sourceIntent */
export function classifySourceClause(clause: string): {
  category: AbstractNarrativeCategory;
  intentCode: string;
  description: string;
} {
  const t = clause.trim();
  if (/停止使用农药|不再.*农药|疯狂的决定|彻底停止/.test(t)) {
    return {
      category: "decision",
      intentCode: "STOP_USING_PESTICIDE",
      description: "主角决定彻底停止使用农药",
    };
  }
  if (/破坏.*生态|过度依赖.*药剂|传统农业.*化学|农药.*破坏/.test(t)) {
    return {
      category: "realization",
      intentCode: "PESTICIDE_HARMS_ECOSYSTEM",
      description: "发现化学药剂破坏生态平衡",
    };
  }
  if (/嘲笑|等死|等着看笑话|冷嘲热讽/.test(t)) {
    return {
      category: "social_pressure",
      intentCode: "NEIGHBORS_MOCK",
      description: "邻居嘲笑主角的选择",
    };
  }
  if (/妻子.*动摇|担心.*生活来源|担心全家|生计/.test(t)) {
    return {
      category: "fear",
      intentCode: "WIFE_FINANCIAL_FEAR",
      description: "妻子担心家庭经济来源",
    };
  }
  if (/发现|意识到|明白|领悟|原来/.test(t)) {
    return {
      category: "realization",
      intentCode: "REALIZATION",
      description: "角色领悟或发现",
    };
  }
  if (/决定|决心|选择|打算/.test(t)) {
    return {
      category: "decision",
      intentCode: "DECISION",
      description: "角色做出决定",
    };
  }
  if (/担心|害怕|恐惧|不安/.test(t)) {
    return {
      category: "fear",
      intentCode: "FEAR",
      description: "角色恐惧或担忧",
    };
  }
  if (/动摇|怀疑|犹豫|纠结/.test(t)) {
    return {
      category: "doubt",
      intentCode: "DOUBT",
      description: "角色动摇或怀疑",
    };
  }
  if (/失败|挫折|亏损|歉收/.test(t)) {
    return {
      category: "failure",
      intentCode: "FAILURE",
      description: "遭遇失败或挫折",
    };
  }
  if (/希望|曙光|转机|好转/.test(t)) {
    return {
      category: "hope",
      intentCode: "HOPE",
      description: "出现希望或转机",
    };
  }
  if (/农药滥用|土壤.*失去活力|失去活力/.test(t)) {
    return {
      category: "historical_context",
      intentCode: "SOIL_DEGRADATION",
      description: "农药滥用导致土壤生态退化",
    };
  }
  if (/年后|数月过去|三年过去|时间流逝|转眼/.test(t)) {
    return {
      category: "time_passage",
      intentCode: "TIME_PASSAGE",
      description: "时间推移",
    };
  }
  if (/据说|历史上|曾经|过去|世代/.test(t)) {
    return {
      category: "historical_context",
      intentCode: "HISTORICAL_CONTEXT",
      description: "历史或背景信息",
    };
  }
  return {
    category: "concrete",
    intentCode: "CONCRETE_ACTION",
    description: "可直接拍摄的具象动作",
  };
}

function visualizeStopUsingPesticide(ctx: VisualizeContext): DraftUnit[] {
  const p = ctx.protagonist;
  const intent = "STOP_USING_PESTICIDE";
  const ref = ctx.sourceRef;
  return [
    draft(ctx, {
      subject: p,
      visibleAction: `${p}关闭喷雾器阀门`,
      object: "喷雾器",
      startState: "阀门开启",
      endState: "阀门关闭",
      visualFocus: "手部关闭阀门",
      purpose: "action",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: p,
      visibleAction: `${p}卸下肩上喷雾器`,
      object: "喷雾器",
      visualFocus: "肩背卸下设备",
      purpose: "action",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: p,
      visibleAction: `${p}将喷雾器放到仓库角落`,
      object: "喷雾器",
      location: "仓库",
      visualFocus: "设备搁置角落",
      purpose: "detail",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: p,
      visibleAction: `${p}关上仓库门`,
      object: "仓库门",
      location: "仓库",
      visualFocus: "仓库门关闭",
      purpose: "transition",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
  ];
}

function visualizePesticideHarmsEcosystem(ctx: VisualizeContext): DraftUnit[] {
  const p = ctx.protagonist;
  const intent = "PESTICIDE_HARMS_ECOSYSTEM";
  const ref = ctx.sourceRef;
  return [
    draft(ctx, {
      subject: p,
      visibleAction: `${p}翻阅农业资料`,
      object: "农业资料",
      visualFocus: "资料页面",
      purpose: "action",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: p,
      visibleAction: `${p}手指停在药剂使用记录页`,
      object: "药剂记录",
      visualFocus: "记录页数字",
      purpose: "detail",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: "死昆虫",
      visibleAction: "枯黄叶片上散落死昆虫",
      object: "死昆虫",
      visualFocus: "叶片昆虫尸体",
      purpose: "reveal",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: "裸土",
      visibleAction: "树根周围裸土不见活虫",
      object: "土壤",
      visualFocus: "无昆虫活动的地面",
      purpose: "detail",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: p,
      visibleAction: `${p}对照笔记后视线停住`,
      object: "笔记",
      visualFocus: "主角停住的目光",
      purpose: "reaction",
      evidenceOf: ref,
      sourceIntent: intent,
      reaction: {
        subject: p,
        visibleBehavior: `${p}眉头紧锁`,
        emotionIntent: "震惊",
      },
    }),
  ];
}

function visualizeNeighborsMock(ctx: VisualizeContext): DraftUnit[] {
  const p = ctx.protagonist;
  const intent = "NEIGHBORS_MOCK";
  const ref = ctx.sourceRef;
  return [
    draft(ctx, {
      subject: "邻居们",
      visibleAction: "三名邻居站在篱笆外看向木村",
      object: "篱笆",
      location: "果园篱笆",
      visualFocus: "篱笆外人群",
      purpose: "establish",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: "邻居",
      visibleAction: "一名邻居抬手指向果园",
      visualFocus: "指向手势",
      purpose: "action",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: "邻居们",
      visibleAction: "几人相互发笑",
      visualFocus: "发笑表情",
      purpose: "reaction",
      evidenceOf: ref,
      sourceIntent: intent,
      reaction: {
        subject: "邻居们",
        visibleBehavior: "捂嘴发笑",
        emotionIntent: "嘲讽",
      },
    }),
    draft(ctx, {
      subject: p,
      visibleAction: `${p}停下手中修剪动作`,
      object: "修枝剪",
      visualFocus: "停下的双手",
      purpose: "reaction",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: p,
      visibleAction: `${p}转头看向篱笆外`,
      visualFocus: "转头方向",
      purpose: "reaction",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: p,
      visibleAction: `${p}低头继续修剪枝条`,
      visualFocus: "重新俯身工作",
      purpose: "action",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
  ];
}

function visualizeWifeFinancialFear(ctx: VisualizeContext): DraftUnit[] {
  const wife = "妻子";
  const intent = "WIFE_FINANCIAL_FEAR";
  const ref = ctx.sourceRef;
  return [
    draft(ctx, {
      subject: wife,
      visibleAction: `${wife}坐在餐桌前`,
      location: "家中餐桌",
      visualFocus: "餐桌坐姿",
      purpose: "establish",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: wife,
      visibleAction: `${wife}翻动账本`,
      object: "账本",
      visualFocus: "账本翻页",
      purpose: "action",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: wife,
      visibleAction: `${wife}手指停在欠款数字上`,
      object: "账本",
      visualFocus: "欠款数字",
      purpose: "detail",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: wife,
      visibleAction: `${wife}看向桌上所剩无几的钞票`,
      object: "钞票",
      visualFocus: "少量现金",
      purpose: "detail",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: wife,
      visibleAction: `${wife}抬头望向窗外果园`,
      object: "窗外果园",
      visualFocus: "窗外远景",
      purpose: "reaction",
      evidenceOf: ref,
      sourceIntent: intent,
      reaction: {
        subject: wife,
        visibleBehavior: `${wife}目光忧虑`,
        emotionIntent: "担忧生计",
      },
    }),
    draft(ctx, {
      subject: wife,
      visibleAction: `${wife}双手握紧账本边缘`,
      object: "账本",
      visualFocus: "握紧的双手",
      purpose: "reaction",
      evidenceOf: ref,
      sourceIntent: intent,
      reaction: {
        subject: wife,
        visibleBehavior: `${wife}指节发白`,
        emotionIntent: "动摇",
      },
    }),
  ];
}

function visualizeGenericDecision(ctx: VisualizeContext): DraftUnit[] {
  const p = ctx.protagonist;
  const intent = "DECISION";
  const ref = ctx.sourceRef;
  return [
    draft(ctx, {
      subject: p,
      visibleAction: `${p}停下手中工作`,
      visualFocus: "停下的动作",
      purpose: "action",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: p,
      visibleAction: `${p}深吸一口气后点头`,
      visualFocus: "点头决定",
      purpose: "reaction",
      evidenceOf: ref,
      sourceIntent: intent,
      reaction: {
        subject: p,
        visibleBehavior: `${p}目光坚定`,
        emotionIntent: "下定决心",
      },
    }),
  ];
}

function visualizeGenericRealization(ctx: VisualizeContext): DraftUnit[] {
  const p = ctx.protagonist;
  const intent = "REALIZATION";
  const ref = ctx.sourceRef;
  return [
    draft(ctx, {
      subject: p,
      visibleAction: `${p}翻看手中资料`,
      object: "资料",
      visualFocus: "资料内容",
      purpose: "action",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: p,
      visibleAction: `${p}视线停在某一行字上`,
      visualFocus: "停住的目光",
      purpose: "detail",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: p,
      visibleAction: `${p}缓缓抬头`,
      visualFocus: "抬头表情",
      purpose: "reaction",
      evidenceOf: ref,
      sourceIntent: intent,
      reaction: {
        subject: p,
        visibleBehavior: `${p}表情凝重`,
        emotionIntent: "领悟",
      },
    }),
  ];
}

function visualizeGenericSocialPressure(ctx: VisualizeContext): DraftUnit[] {
  const p = ctx.protagonist;
  const intent = "SOCIAL_PRESSURE";
  const ref = ctx.sourceRef;
  return [
    draft(ctx, {
      subject: "围观者",
      visibleAction: "几人站在远处指指点点",
      visualFocus: "指点人群",
      purpose: "establish",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: p,
      visibleAction: `${p}听到议论后转头`,
      visualFocus: "转头反应",
      purpose: "reaction",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
  ];
}

function visualizeGenericFear(ctx: VisualizeContext): DraftUnit[] {
  if (ctx.clause.includes("妻子")) {
    return visualizeWifeFinancialFear(ctx);
  }
  const subject = ctx.protagonist;
  const intent = "FEAR";
  const ref = ctx.sourceRef;
  return [
    draft(ctx, {
      subject,
      visibleAction: `${subject}双手微微颤抖`,
      visualFocus: "颤抖的双手",
      purpose: "reaction",
      evidenceOf: ref,
      sourceIntent: intent,
      reaction: {
        subject,
        visibleBehavior: `${subject}咬紧嘴唇`,
        emotionIntent: "恐惧",
      },
    }),
  ];
}

function visualizeSoilDegradation(ctx: VisualizeContext): DraftUnit[] {
  const ref = ctx.sourceRef;
  const intent = "SOIL_DEGRADATION";
  return [
    draft(ctx, {
      subject: "土壤",
      visibleAction: "果园地表土壤干裂发白",
      object: "土壤",
      location: ctx.location,
      visualFocus: "干裂土壤",
      purpose: "detail",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: "枯叶",
      visibleAction: "枯叶覆盖树根周围裸土",
      object: "枯叶",
      visualFocus: "裸土与枯叶",
      purpose: "reveal",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: "果树",
      visibleAction: "果树根系部分裸露地表",
      object: "树根",
      visualFocus: "裸露根系",
      purpose: "detail",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
  ];
}

function visualizeTimePassage(ctx: VisualizeContext): DraftUnit[] {
  const ref = ctx.sourceRef;
  const intent = "TIME_PASSAGE";
  const p = ctx.protagonist;
  return [
    draft(ctx, {
      subject: p,
      visibleAction: "日历页逐页翻过",
      object: "日历",
      visualFocus: "翻页日历",
      purpose: "transition",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: ctx.location,
      visibleAction: `${ctx.location}树叶由绿转黄`,
      location: ctx.location,
      visualFocus: "季节变化",
      purpose: "transition",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
  ];
}

function visualizeHistoricalContext(ctx: VisualizeContext): DraftUnit[] {
  const ref = ctx.sourceRef;
  const intent = "HISTORICAL_CONTEXT";
  return [
    draft(ctx, {
      subject: "果农",
      visibleAction: "几名果农在果园中劳作",
      location: ctx.location,
      visualFocus: "劳作人群",
      purpose: "establish",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
  ];
}

function visualizeHope(ctx: VisualizeContext): DraftUnit[] {
  const p = ctx.protagonist;
  const ref = ctx.sourceRef;
  const intent = "HOPE";
  return [
    draft(ctx, {
      subject: "新芽",
      visibleAction: "枯枝上抽出嫩绿新芽",
      object: "新芽",
      visualFocus: "枝头新芽",
      purpose: "reveal",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: p,
      visibleAction: `${p}停步注视新芽`,
      visualFocus: "停步注视",
      purpose: "reaction",
      evidenceOf: ref,
      sourceIntent: intent,
      reaction: { subject: p, visibleBehavior: `${p}嘴角微扬`, emotionIntent: "希望" },
    }),
  ];
}

function visualizeFailure(ctx: VisualizeContext): DraftUnit[] {
  const p = ctx.protagonist;
  const ref = ctx.sourceRef;
  const intent = "FAILURE";
  return [
    draft(ctx, {
      subject: p,
      visibleAction: `${p}翻看催款通知`,
      object: "账单",
      visualFocus: "催款单据",
      purpose: "detail",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
    draft(ctx, {
      subject: p,
      visibleAction: `${p}肩膀下沉`,
      visualFocus: "肩颈线条",
      purpose: "reaction",
      evidenceOf: ref,
      sourceIntent: intent,
      reaction: { subject: p, visibleBehavior: `${p}长叹一声`, emotionIntent: "压力" },
    }),
  ];
}

function visualizeConcreteClause(ctx: VisualizeContext): DraftUnit[] {
  const p = ctx.protagonist;
  const ref = ctx.sourceRef;
  const intent = "CONCRETE_ACTION";
  const clause = ctx.clause;

  const actionMatch = clause.match(
    /(走|站|坐|拿|放|推|拉|开|关|翻|看|指|笑|哭|喊|跑|停|握|剪|喷|浇|挖|种|摘|扛|背|写|读|抬头|低头|转身)/,
  );
  if (actionMatch) {
    let subject = p;
    if (/妻子|邻居|孩子|老人/.test(clause)) {
      const m = clause.match(/(妻子|邻居们?|孩子|老人)/);
      if (m) subject = m[1]!;
    }
    const verb = actionMatch[1]!;
    const tail = clause.slice(clause.indexOf(verb)).slice(0, 18);
    const visible = `${subject}${tail}`.slice(0, 30);
    return [
      draft(ctx, {
        subject,
        visibleAction: visible,
        visualFocus: visible.slice(0, 12),
        purpose: "action",
        evidenceOf: ref,
        sourceIntent: intent,
      }),
    ];
  }

  if (/果园|山坡|晨雾|树行|仓库|餐桌/.test(clause)) {
    const loc = /仓库/.test(clause)
      ? "仓库"
      : /餐桌|家中/.test(clause)
        ? "家中"
        : ctx.location;
    const desc = /晨雾/.test(clause)
      ? `晨雾中的${loc}沿山坡展开`
      : /树行/.test(clause)
        ? `${loc}内整齐树行延伸`
        : `${loc}在日光下清晰可见`;
    return [
      draft(ctx, {
        subject: loc,
        visibleAction: desc,
        location: loc,
        visualFocus: desc.slice(0, 12),
        purpose: "establish",
        evidenceOf: ref,
        sourceIntent: intent,
      }),
    ];
  }

  return [
    draft(ctx, {
      subject: p,
      visibleAction: `${p}在${ctx.location}继续劳作`,
      location: ctx.location,
      visualFocus: "劳作动作",
      purpose: "action",
      evidenceOf: ref,
      sourceIntent: intent,
    }),
  ];
}

/** 将抽象叙事转为可拍摄 VisualActionUnit */
export function visualizeAbstractClause(
  ctx: VisualizeContext,
  classification: ReturnType<typeof classifySourceClause>,
): VisualActionUnit[] {
  let drafts: DraftUnit[];
  switch (classification.intentCode) {
    case "STOP_USING_PESTICIDE":
      drafts = visualizeStopUsingPesticide(ctx);
      break;
    case "PESTICIDE_HARMS_ECOSYSTEM":
      drafts = visualizePesticideHarmsEcosystem(ctx);
      break;
    case "NEIGHBORS_MOCK":
      drafts = visualizeNeighborsMock(ctx);
      break;
    case "WIFE_FINANCIAL_FEAR":
      drafts = visualizeWifeFinancialFear(ctx);
      break;
    case "DECISION":
      drafts = visualizeGenericDecision(ctx);
      break;
    case "REALIZATION":
      drafts = visualizeGenericRealization(ctx);
      break;
    case "FEAR":
    case "DOUBT":
      drafts = visualizeGenericFear(ctx);
      break;
    case "SOIL_DEGRADATION":
      drafts = visualizeSoilDegradation(ctx);
      break;
    case "TIME_PASSAGE":
      drafts = visualizeTimePassage(ctx);
      break;
    case "HISTORICAL_CONTEXT":
      drafts = visualizeHistoricalContext(ctx);
      break;
    case "HOPE":
      drafts = visualizeHope(ctx);
      break;
    case "FAILURE":
      drafts = visualizeFailure(ctx);
      break;
    default:
      drafts = visualizeConcreteClause(ctx);
  }
  return finalizeDrafts(ctx, drafts);
}

export function buildSourceIntent(sourceRef: string, clause: string): SourceIntent {
  const c = classifySourceClause(clause);
  return { sourceRef, category: c.category, intentCode: c.intentCode, description: c.description };
}

const INTENT_EVIDENCE_KEYWORDS: Record<string, string[]> = {
  STOP_USING_PESTICIDE: ["喷雾器", "阀门", "卸下", "仓库", "关闭"],
  PESTICIDE_HARMS_ECOSYSTEM: ["资料", "药剂", "昆虫", "裸土", "笔记"],
  NEIGHBORS_MOCK: ["邻居", "篱笆", "发笑", "指向"],
  WIFE_FINANCIAL_FEAR: ["账本", "欠款", "钞票", "妻子", "握紧"],
  DECISION: ["停下", "点头", "深吸"],
  REALIZATION: ["资料", "视线", "抬头"],
  FEAR: ["颤抖", "账本", "忧虑"],
  DOUBT: ["账本", "握紧"],
  SOIL_DEGRADATION: ["土壤", "枯叶", "根系", "干裂", "裸土"],
  TIME_PASSAGE: ["日历", "翻页", "转黄", "季节"],
  HISTORICAL_CONTEXT: ["果农", "劳作"],
  HOPE: ["新芽", "嫩绿", "注视"],
  FAILURE: ["催款", "账单", "肩膀", "下沉"],
};

export function intentHasVisualEvidence(
  intentCode: string,
  units: VisualActionUnit[],
  sourceRef: string,
): boolean {
  const related = units.filter((u) => u.evidenceOf === sourceRef || u.sourceIntent === intentCode);
  if (!related.length) return false;
  const keywords = INTENT_EVIDENCE_KEYWORDS[intentCode];
  if (!keywords) return related.length > 0;
  const text = related.map((u) => `${u.visibleAction} ${u.object ?? ""}`).join(" ");
  return keywords.some((kw) => text.includes(kw));
}

export function reactionFromUnit(unit: VisualActionUnit): string {
  return unit.reaction?.visibleBehavior ?? "";
}
