/** Client-safe：仅类型与纯函数，无 OpenAI / Node 依赖 */
export type {
  NarrativeBeat,
  NarrativeShot,
  BeatSplitDiagnostics,
  NarrativeStoryboardResult,
} from "./types";
export { detectMultiAction, analyzeMultiActionViolations } from "./validate-multi-action";
export { computeBeatSplitDiagnostics, isUnderSplitBeat, shotsForBeat } from "./validate-beat-split";
