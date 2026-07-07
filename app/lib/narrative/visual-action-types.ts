/** 可拍摄的视觉事件原子（≠ Shot） */
export type VisualActionPurpose =
  | "establish"
  | "action"
  | "detail"
  | "reaction"
  | "reveal"
  | "transition";

export type AbstractNarrativeCategory =
  | "decision"
  | "realization"
  | "fear"
  | "doubt"
  | "social_pressure"
  | "failure"
  | "hope"
  | "time_passage"
  | "information"
  | "historical_context"
  | "concrete";

export type SourceIntent = {
  sourceRef: string;
  category: AbstractNarrativeCategory;
  intentCode: string;
  description: string;
};

export type UnitReaction = {
  subject: string;
  visibleBehavior: string;
  emotionIntent?: string;
};

export type VisualActionUnit = {
  unitId: string;
  beatId: string;
  subject: string;
  visibleAction: string;
  startState?: string;
  endState?: string;
  object?: string;
  location?: string;
  /** 该 Unit 为哪条抽象叙事的视觉证据 */
  evidenceOf?: string;
  reaction?: UnitReaction;
  visualFocus: string;
  purpose: VisualActionPurpose;
  sourceRef: string;
  sourceIntent?: string;
};

export type ShotDirectorQA = {
  visualActionUnitCount: number;
  shotCount: number;
  unitToShotRatio: number;
  oneToOneMappingRatio: number;
  suspiciousStrictUnitShotMapping: boolean;

  textCopyShotCount: number;
  actionTooLongCount: number;
  multiActionShotCount: number;
  emptyReactionActionCount: number;
  cameraMonotonyCount: number;
  weakActionShotCount: number;

  genericVisualActionCount: number;
  abstractReactionCount: number;
  subjectMismatchCount: number;
  reactionSubjectMismatchCount: number;
  duplicateVisualUnitCount: number;
  semanticLossCount: number;

  textCopyShotIds: string[];
  actionTooLongIds: string[];
  multiActionShotIds: string[];
  emptyReactionActionIds: string[];
  cameraMonotonyIds: string[];
  weakActionShotIds: string[];
  genericVisualActionIds: string[];
  abstractReactionIds: string[];
  subjectMismatchIds: string[];
  reactionSubjectMismatchIds: string[];
  duplicateVisualUnitIds: string[];
  semanticLossIntents: string[];
};

export type BeatShotGenerationResult = {
  beat: import("./types").NarrativeBeat;
  units: VisualActionUnit[];
  sourceIntents: SourceIntent[];
  shots: Omit<import("./types").NarrativeShot, "shotId" | "sceneNumber" | "duration">[];
  qa: ShotDirectorQA;
};

/** 镜头尺度（Shot Director 内部使用） */
export type SuggestedShotScale =
  | "extreme_wide"
  | "wide"
  | "medium"
  | "close_up"
  | "extreme_close_up";

export type SuggestedShotAngle =
  | "eye_level"
  | "low"
  | "high"
  | "over_shoulder"
  | "pov"
  | "top_down";
