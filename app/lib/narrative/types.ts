/** Narrative Beat — 完整微型剧情过程（≠ 句子 / 段落 / 单信息点） */
export type NarrativeBeat = {
  beatId: string;
  /** 原脚本节选（完整 Beat 覆盖的文本，可跨多句） */
  sourceText: string;
  /** 本 Beat 叙事意图（完整微型剧情过程） */
  beatGoal: string;
  narrativePurpose: string;
  characters: string[];
  environment: string;
  emotionalState: string;
  informationChange: string;
  estimatedNarrationWeight: number;
  narration?: string;
  /** 拆镜阶段填充：动作过程阶段 */
  actionProcess?: string[];
  reactionProcess?: string[];
  informationReveal?: string;
  visualProgression?: string[];
};

/** 自然拆解的叙事镜头（Beat 内的视觉动作阶段） */
export type NarrativeShot = {
  shotId: string;
  beatId: string;
  sceneNumber: number;
  character: string;
  action: string;
  reaction: string;
  environment: string;
  camera: string;
  visualFocus: string;
  shotPurpose: string;
  narration: string;
  narrationRef: string;
  duration: number;
  transition: string;
};

export type BeatSplitDiagnostics = {
  underSplitBeatCount: number;
  singleShotBeatCount: number;
  multiActionSingleShotCount: number;
  underSplitBeatIds: string[];
  singleShotBeatIds: string[];
};

export type NarrativeStoryboardResult = {
  beats: NarrativeBeat[];
  shots: NarrativeShot[];
  splitDiagnostics?: BeatSplitDiagnostics;
};
