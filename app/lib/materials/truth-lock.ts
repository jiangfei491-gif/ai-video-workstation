/** 内容类型（决定入库锁预设） */
export const CONTENT_TYPES = [
  "真实案件",
  "历史",
  "战争",
  "财富人物",
  "未解之谜",
  "神话",
  "原创故事",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export function isContentType(value: string): value is ContentType {
  return CONTENT_TYPES.includes(value as ContentType);
}

/** 入库时写入的锁字段（方案一） */
export type MaterialLockFields = {
  contentType: ContentType;
  truthLock: number;
  allowSpeculation: boolean;
  allowDialogue: boolean;
  allowFiction: boolean;
  forbidNewCharacters: boolean;
  forbidNewEvents: boolean;
  forbidChangeEnding: boolean;
};

type LockPreset = MaterialLockFields & { safetyLevel: number };

export const CONTENT_TYPE_PRESETS: Record<ContentType, LockPreset> = {
  真实案件: {
    contentType: "真实案件",
    safetyLevel: 5,
    truthLock: 100,
    allowSpeculation: false,
    allowDialogue: false,
    allowFiction: false,
    forbidNewCharacters: true,
    forbidNewEvents: true,
    forbidChangeEnding: true,
  },
  历史: {
    contentType: "历史",
    safetyLevel: 4,
    truthLock: 90,
    allowSpeculation: true,
    allowDialogue: false,
    allowFiction: false,
    forbidNewCharacters: true,
    forbidNewEvents: true,
    forbidChangeEnding: true,
  },
  战争: {
    contentType: "战争",
    safetyLevel: 4,
    truthLock: 100,
    allowSpeculation: false,
    allowDialogue: false,
    allowFiction: false,
    forbidNewCharacters: true,
    forbidNewEvents: true,
    forbidChangeEnding: true,
  },
  财富人物: {
    contentType: "财富人物",
    safetyLevel: 3,
    truthLock: 95,
    allowSpeculation: true,
    allowDialogue: false,
    allowFiction: false,
    forbidNewCharacters: true,
    forbidNewEvents: true,
    forbidChangeEnding: true,
  },
  未解之谜: {
    contentType: "未解之谜",
    safetyLevel: 2,
    truthLock: 80,
    allowSpeculation: true,
    allowDialogue: false,
    allowFiction: false,
    forbidNewCharacters: true,
    forbidNewEvents: true,
    forbidChangeEnding: true,
  },
  神话: {
    contentType: "神话",
    safetyLevel: 1,
    truthLock: 30,
    allowSpeculation: true,
    allowDialogue: true,
    allowFiction: true,
    forbidNewCharacters: false,
    forbidNewEvents: false,
    forbidChangeEnding: false,
  },
  原创故事: {
    contentType: "原创故事",
    safetyLevel: 0,
    truthLock: 0,
    allowSpeculation: true,
    allowDialogue: true,
    allowFiction: true,
    forbidNewCharacters: false,
    forbidNewEvents: false,
    forbidChangeEnding: false,
  },
};

const CATEGORY_TO_CONTENT_TYPE: Record<string, ContentType> = {
  故事: "原创故事",
  历史: "历史",
  悬疑: "真实案件",
  财富: "财富人物",
  战争: "战争",
  科技: "历史",
  未解之谜: "未解之谜",
};

export function contentTypeFromCategory(category: string): ContentType {
  return CATEGORY_TO_CONTENT_TYPE[category.trim()] ?? "原创故事";
}

export function lockFieldsForContentType(contentType: ContentType): MaterialLockFields {
  const p = CONTENT_TYPE_PRESETS[contentType];
  return {
    contentType: p.contentType,
    truthLock: p.truthLock,
    allowSpeculation: p.allowSpeculation,
    allowDialogue: p.allowDialogue,
    allowFiction: p.allowFiction,
    forbidNewCharacters: p.forbidNewCharacters,
    forbidNewEvents: p.forbidNewEvents,
    forbidChangeEnding: p.forbidChangeEnding,
  };
}

export function defaultLockFieldsForCategory(category: string): MaterialLockFields {
  return lockFieldsForContentType(contentTypeFromCategory(category));
}

/** 旧嵌套 truthLock 对象（兼容读取） */
type LegacyTruthLock = MaterialLockFields & {
  safetyLevel?: number;
  forbidFabricatedEvidence?: boolean;
};

function hasFlatLockFields(material: {
  contentType?: ContentType;
  truthLock?: number;
}): boolean {
  return typeof material.contentType === "string" && typeof material.truthLock === "number";
}

/** 读取锁字段；旧数据按分类回填预设 */
export function getMaterialLockFields(material: {
  category: string;
  contentType?: ContentType;
  truthLock?: number;
  allowSpeculation?: boolean;
  allowDialogue?: boolean;
  allowFiction?: boolean;
  forbidNewCharacters?: boolean;
  forbidNewEvents?: boolean;
  forbidChangeEnding?: boolean;
}): MaterialLockFields {
  if (hasFlatLockFields(material)) {
    return {
      contentType: material.contentType!,
      truthLock: material.truthLock!,
      allowSpeculation: Boolean(material.allowSpeculation),
      allowDialogue: Boolean(material.allowDialogue),
      allowFiction: Boolean(material.allowFiction),
      forbidNewCharacters: Boolean(material.forbidNewCharacters),
      forbidNewEvents: Boolean(material.forbidNewEvents),
      forbidChangeEnding: Boolean(material.forbidChangeEnding),
    };
  }

  const legacy = material as {
    truthLock?: LegacyTruthLock | number;
  };
  const nested = legacy.truthLock;
  if (nested && typeof nested === "object" && "contentType" in nested) {
    const l = nested as LegacyTruthLock;
    return {
      contentType: l.contentType,
      truthLock: l.truthLock,
      allowSpeculation: l.allowSpeculation,
      allowDialogue: l.allowDialogue,
      allowFiction: l.allowFiction,
      forbidNewCharacters: l.forbidNewCharacters,
      forbidNewEvents: l.forbidNewEvents,
      forbidChangeEnding: l.forbidChangeEnding,
    };
  }

  return defaultLockFieldsForCategory(material.category);
}

export function formatSafetyLevelLabel(contentType: ContentType): string {
  const level = CONTENT_TYPE_PRESETS[contentType]?.safetyLevel ?? 0;
  return `L${level}`;
}
