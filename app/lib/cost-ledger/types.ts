/** 文本类 API 单行（脚本 / 分镜 / Prompt） */
export type TokenCostLine = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

/** 按次计费（FLUX / Vision QC / GPT Image）；Vision / GPT Image 有真实 token 时填入 */
export type CallCostLine = {
  calls: number;
  costPerCallUsd: number;
  totalCostUsd: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

/** 单次 API 用量（文本 / Vision / 生图） */
export type ApiUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type DirectorCostDetail = {
  script: TokenCostLine;
  storyboard: TokenCostLine;
  prompts: TokenCostLine;
};

export type ShotPipelineCostDetail = {
  flux: CallCostLine;
  visionQc: CallCostLine;
  gptImage: CallCostLine;
};

export type ProjectCostLedger = DirectorCostDetail & {
  flux: CallCostLine;
  visionQc: CallCostLine;
  gptImage: CallCostLine;
  totalCostUsd: number;
  updatedAt: string;
};

export type DirectorChatUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};
