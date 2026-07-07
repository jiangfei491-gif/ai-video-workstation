import { MATERIAL_CATEGORY_ALL, MATERIAL_CATEGORIES } from "./types";

/** 各分类的默认任务描述（切换分类时若未手动改过则自动替换） */
export const AGENT_TASK_TEMPLATES: Record<string, string> = {
  [MATERIAL_CATEGORY_ALL]:
    "真实、可考证、适合做短视频的素材，有人物、冲突、转折与结局",
  故事: "有人物、有冲突、有转折、有结局的真实故事，适合短视频讲述",
  历史: "适合历史频道、有人物有冲突有结局的真实历史故事",
  悬疑: "适合悬疑频道、有反转有悬念的真实案件或未解事件",
  财富: "商业人物、财富起落、有冲突有结局的真实案例",
  战争: "战争背景下的真实人物故事，有冲突、有转折、有结局",
  科技: "适合科技频道、有突破性转折的真实科技人物、发明或产业故事",
  "未解之谜": "有悬念、有未解转折的真实神秘事件，适合科普解说",
};

const ALL_TEMPLATE_TEXTS = new Set(Object.values(AGENT_TASK_TEMPLATES));

export function defaultAgentTaskForCategory(category: string): string {
  return AGENT_TASK_TEMPLATES[category] ?? AGENT_TASK_TEMPLATES["故事"];
}

export function isDefaultAgentTask(text: string): boolean {
  return ALL_TEMPLATE_TEXTS.has(text.trim());
}

export function resolveAgentTaskOnCategoryChange(
  currentTask: string,
  newCategory: string
): string {
  if (isDefaultAgentTask(currentTask)) {
    return defaultAgentTaskForCategory(newCategory);
  }
  return currentTask;
}

/** 确保分类键合法 */
export function isKnownSearchCategory(category: string): boolean {
  return (
    category === MATERIAL_CATEGORY_ALL ||
    (MATERIAL_CATEGORIES as readonly string[]).includes(category)
  );
}
