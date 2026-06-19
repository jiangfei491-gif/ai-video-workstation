export type ImageAsset = {
  id: string;
  source: "gpt-image-2" | "gpt-image-1";
  prompt: string;
  filepath: string;
  publicUrl: string;
  width: number;
  height: number;
  model: string;
  createdAt: string;
};

export type FirstFrameAsset = {
  id: string;
  shotId: string;
  sourceClipUrl: string;
  filepath: string;
  publicUrl: string;
  createdAt: string;
};

export type VideoClipAsset = {
  id: string;
  shotId: string;
  mode: "test" | "production";
  filepath: string;
  publicUrl: string;
  taskId: string;
  durationSec: number;
  createdAt: string;
};

/**
 * 角色档案 —— @引用一致性系统的核心。
 * 提示词里写 @name，生成前最后一刻自动替换为 name (appearance)，
 * 用服装/外观锚定保证跨镜头的人物一致性。
 */
export type CharacterAsset = {
  id: string;
  /** @引用用的名字，如 六子 / Anna */
  name: string;
  /** 注入提示词的外观描述（英文，服装/特征锚点） */
  appearance: string;
  /** 参考图（可选） */
  refImageUrl?: string;
  refImagePath?: string;
  createdAt: string;
};
