import { intentHasVisualEvidence } from "./abstract-narrative-visualizer";
import { detectMultiAction } from "./validate-multi-action";
import type { NarrativeBeat, NarrativeShot } from "./types";
import type { ShotDirectorQA, SourceIntent, VisualActionUnit } from "./visual-action-types";
import { focusCategory, shotAngleFromCamera, shotScaleFromCamera } from "./shot-director";

const WEAK_ACTION = /^人物反应$|^未指定动作$|^人物(站着|看着|走着|停下)/;

const GENERIC_PATTERNS = [
  /画面呈现/,
  /空间呈现/,
  /全景呈现/,
  /局部画面变化/,
  /环境变化/,
  /^人物反应$/,
  /人群分布/,
  /状态变化/,
  /情况异常/,
  /气氛变化/,
  /画面渐显/,
  /颜色异常$/,
];

const OBSERVABLE_MARKERS =
  /晨雾|山坡|树行|篱笆|阀门|喷雾器|账本|欠款|邻居|发笑|手指|叶片|昆虫|裸土|仓库|钞票|薄膜|害虫|果实|笔记本|资料|药剂|蹲下|展开|摘除|转头|低头|握紧|翻|停|关闭|卸下|指向|三名|几人/;

function isTextCopy(action: string, sourceText: string): boolean {
  const a = action.trim();
  if (!a || a.length < 8) return false;
  if (sourceText.includes(a)) return true;
  const sentences = sourceText.split(/[。！？；\n]+/).map((s) => s.trim());
  for (const s of sentences) {
    if (s.length < 8) continue;
    if (s.includes(a) || a.includes(s.slice(0, Math.min(s.length, a.length + 5)))) return true;
  }
  return false;
}

function isWeakShot(shot: NarrativeShot): boolean {
  return WEAK_ACTION.test(shot.action.trim()) || WEAK_ACTION.test(shot.reaction.trim());
}

function isGenericVisualAction(action: string): boolean {
  const a = action.trim();
  if (!a) return true;
  const hitsGeneric = GENERIC_PATTERNS.some((p) => p.test(a));
  if (!hitsGeneric) return false;
  return !OBSERVABLE_MARKERS.test(a);
}

function isAbstractReaction(reaction: string): boolean {
  const r = reaction.trim();
  if (!r) return false;
  if (/担心|动摇|生活来源|信念|绝望|恐惧|不安|犹豫/.test(r) && !OBSERVABLE_MARKERS.test(r)) {
    return true;
  }
  if (r.length > 12 && !/(手|指|眼|头|肩|握|转|低|抬|咬|皱|发笑|指向)/.test(r)) {
    return true;
  }
  return false;
}

function countCameraMonotony(shots: NarrativeShot[]): string[] {
  const ids: string[] = [];
  for (let i = 2; i < shots.length; i++) {
    const a = shots[i - 2]!;
    const b = shots[i - 1]!;
    const c = shots[i]!;
    const sameScale =
      shotScaleFromCamera(a.camera) === shotScaleFromCamera(b.camera) &&
      shotScaleFromCamera(b.camera) === shotScaleFromCamera(c.camera);
    const sameAngle =
      shotAngleFromCamera(a.camera) === shotAngleFromCamera(b.camera) &&
      shotAngleFromCamera(b.camera) === shotAngleFromCamera(c.camera);
    const sameFocus =
      focusCategory(a.visualFocus) === focusCategory(b.visualFocus) &&
      focusCategory(b.visualFocus) === focusCategory(c.visualFocus);
    if (sameScale && sameAngle && sameFocus) ids.push(c.shotId);
  }
  return ids;
}

function countDuplicateVisualUnits(units: VisualActionUnit[]): string[] {
  const ids: string[] = [];
  for (let i = 1; i < units.length; i++) {
    const prev = units[i - 1]!;
    const cur = units[i]!;
    if (
      prev.visibleAction === cur.visibleAction &&
      prev.subject === cur.subject &&
      prev.purpose === cur.purpose &&
      prev.evidenceOf === cur.evidenceOf
    ) {
      ids.push(cur.unitId);
    }
  }
  return ids;
}

function countSubjectMismatches(
  shots: NarrativeShot[],
  units: VisualActionUnit[],
): string[] {
  const unitMap = new Map(units.map((u) => [u.unitId, u]));
  const ids: string[] = [];
  for (const shot of shots) {
    const raw = shot as NarrativeShot & { sourceUnitIds?: string[] };
    const unitId = raw.sourceUnitIds?.[0];
    if (!unitId) continue;
    const unit = unitMap.get(unitId);
    if (!unit) continue;
    if (unit.purpose === "reaction" && unit.reaction?.subject) {
      if (shot.character !== unit.reaction.subject && shot.character !== unit.subject) {
        ids.push(shot.shotId);
      }
    } else if (unit.subject && shot.character !== unit.subject && unit.subject !== "死昆虫" && unit.subject !== "裸土") {
      // 环境/道具 subject 允许映射到场景
      if (!/果园|仓库|家中|篱笆|邻居/.test(unit.subject) && shot.character !== unit.subject) {
        ids.push(shot.shotId);
      }
    }
  }
  return ids;
}

function countReactionSubjectMismatches(
  shots: NarrativeShot[],
  units: VisualActionUnit[],
): string[] {
  const unitMap = new Map(units.map((u) => [u.unitId, u]));
  const ids: string[] = [];
  for (const shot of shots) {
    const raw = shot as NarrativeShot & { sourceUnitIds?: string[] };
    for (const uid of raw.sourceUnitIds ?? []) {
      const unit = unitMap.get(uid);
      if (!unit?.reaction?.subject) continue;
      if (unit.purpose === "reaction" || unit.reaction) {
        if (shot.character !== unit.reaction.subject && shot.character !== unit.subject) {
          ids.push(shot.shotId);
        }
      }
    }
  }
  return ids;
}

function countSemanticLoss(
  sourceIntents: SourceIntent[],
  units: VisualActionUnit[],
): string[] {
  const lost: string[] = [];
  const abstractIntents = sourceIntents.filter(
    (s) => s.category !== "concrete" && s.intentCode !== "ESTABLISH" && s.intentCode !== "CONCRETE_ACTION",
  );
  for (const intent of abstractIntents) {
    if (!intentHasVisualEvidence(intent.intentCode, units, intent.sourceRef)) {
      lost.push(`${intent.intentCode}:${intent.sourceRef}`);
    }
  }
  return lost;
}

export function runShotDirectorQA(params: {
  beats: NarrativeBeat[];
  shots: NarrativeShot[];
  units: VisualActionUnit[];
  sourceIntents?: SourceIntent[];
}): ShotDirectorQA {
  const { beats, shots, units, sourceIntents = [] } = params;
  const beatSource = new Map(beats.map((b) => [b.beatId, b.sourceText]));

  const textCopyShotIds: string[] = [];
  const actionTooLongIds: string[] = [];
  const multiActionShotIds: string[] = [];
  const emptyReactionActionIds: string[] = [];
  const weakActionShotIds: string[] = [];
  const genericVisualActionIds: string[] = [];
  const abstractReactionIds: string[] = [];

  for (const shot of shots) {
    const src = beatSource.get(shot.beatId) ?? "";
    if (isTextCopy(shot.action, src)) textCopyShotIds.push(shot.shotId);
    if (shot.action.length > 30) actionTooLongIds.push(shot.shotId);
    if (detectMultiAction(shot.action).flagged) multiActionShotIds.push(shot.shotId);
    if ((shot.shotPurpose === "人物反应" || shot.reaction) && !shot.action.trim()) {
      emptyReactionActionIds.push(shot.shotId);
    }
    if (isWeakShot(shot)) weakActionShotIds.push(shot.shotId);
    if (isGenericVisualAction(shot.action)) genericVisualActionIds.push(shot.shotId);
    if (isAbstractReaction(shot.reaction)) abstractReactionIds.push(shot.shotId);
  }

  for (const unit of units) {
    if (isGenericVisualAction(unit.visibleAction) && !genericVisualActionIds.includes(unit.unitId)) {
      genericVisualActionIds.push(unit.unitId);
    }
  }

  const cameraMonotonyIds = countCameraMonotony(shots);
  const duplicateVisualUnitIds = countDuplicateVisualUnits(units);
  const subjectMismatchIds = countSubjectMismatches(shots, units);
  const reactionSubjectMismatchIds = countReactionSubjectMismatches(shots, units);
  const semanticLossIntents = countSemanticLoss(sourceIntents, units);

  const unitToShotRatio = units.length > 0 ? shots.length / units.length : 1;
  const oneToOneMappingRatio = unitToShotRatio;

  return {
    visualActionUnitCount: units.length,
    shotCount: shots.length,
    unitToShotRatio,
    oneToOneMappingRatio,
    suspiciousStrictUnitShotMapping: oneToOneMappingRatio === 1.0 && units.length > 10,

    textCopyShotCount: textCopyShotIds.length,
    actionTooLongCount: actionTooLongIds.length,
    multiActionShotCount: multiActionShotIds.length,
    emptyReactionActionCount: emptyReactionActionIds.length,
    cameraMonotonyCount: cameraMonotonyIds.length,
    weakActionShotCount: weakActionShotIds.length,

    genericVisualActionCount: genericVisualActionIds.length,
    abstractReactionCount: abstractReactionIds.length,
    subjectMismatchCount: subjectMismatchIds.length,
    reactionSubjectMismatchCount: reactionSubjectMismatchIds.length,
    duplicateVisualUnitCount: duplicateVisualUnitIds.length,
    semanticLossCount: semanticLossIntents.length,

    textCopyShotIds,
    actionTooLongIds,
    multiActionShotIds,
    emptyReactionActionIds,
    cameraMonotonyIds,
    weakActionShotIds,
    genericVisualActionIds,
    abstractReactionIds,
    subjectMismatchIds,
    reactionSubjectMismatchIds,
    duplicateVisualUnitIds,
    semanticLossIntents,
  };
}

/** 硬 QA 违规清单（不抛错，供重试/降级/日志复用） */
export function shotDirectorHardFailures(qa: ShotDirectorQA): string[] {
  const fails: string[] = [];
  if (qa.textCopyShotCount > 0) fails.push(`TEXT_COPY_SHOT: ${qa.textCopyShotIds.join(", ")}`);
  if (qa.actionTooLongCount > 0) fails.push(`ACTION_TOO_LONG: ${qa.actionTooLongIds.join(", ")}`);
  if (qa.multiActionShotCount > 0)
    fails.push(`MULTI_ACTION_SHOT: ${qa.multiActionShotIds.join(", ")}`);
  if (qa.emptyReactionActionCount > 0)
    fails.push(`EMPTY_REACTION_ACTION: ${qa.emptyReactionActionIds.join(", ")}`);
  if (qa.genericVisualActionCount > 0)
    fails.push(`GENERIC_VISUAL_ACTION: ${qa.genericVisualActionIds.join(", ")}`);
  if (qa.abstractReactionCount > 0)
    fails.push(`ABSTRACT_REACTION: ${qa.abstractReactionIds.join(", ")}`);
  if (qa.subjectMismatchCount > 0)
    fails.push(`SUBJECT_MISMATCH: ${qa.subjectMismatchIds.join(", ")}`);
  if (qa.reactionSubjectMismatchCount > 0)
    fails.push(`REACTION_SUBJECT_MISMATCH: ${qa.reactionSubjectMismatchIds.join(", ")}`);
  if (qa.duplicateVisualUnitCount > 0)
    fails.push(`DUPLICATE_VISUAL_UNIT: ${qa.duplicateVisualUnitIds.join(", ")}`);
  if (qa.semanticLossCount > 0)
    fails.push(`SEMANTIC_LOSS: ${qa.semanticLossIntents.join("; ")}`);
  return fails;
}

export function assertShotDirectorHardQA(qa: ShotDirectorQA): void {
  const fails = shotDirectorHardFailures(qa);
  if (fails.length) {
    throw new Error(`Shot Director QA 未通过:\n${fails.join("\n")}`);
  }
}
