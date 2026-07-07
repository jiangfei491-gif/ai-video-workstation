import type { NarrativeBeat } from "./types";
import type { SuggestedShotAngle, SuggestedShotScale, VisualActionUnit } from "./visual-action-types";

const SCALE_LABEL: Record<SuggestedShotScale, string> = {
  extreme_wide: "大远景",
  wide: "广角全景",
  medium: "中景",
  close_up: "近景特写",
  extreme_close_up: "大特写",
};

const ANGLE_LABEL: Record<SuggestedShotAngle, string> = {
  eye_level: "平视",
  low: "低角度仰拍",
  high: "高角度俯拍",
  over_shoulder: "过肩镜头",
  pov: "主观视角",
  top_down: "垂直俯拍",
};

function purposeLabel(purpose: VisualActionUnit["purpose"]): string {
  const map: Record<VisualActionUnit["purpose"], string> = {
    establish: "场景定场",
    action: "动作推进",
    detail: "细节呈现",
    reaction: "人物反应",
    reveal: "信息揭示",
    transition: "转场过渡",
  };
  return map[purpose];
}

function inferScale(unit: VisualActionUnit): SuggestedShotScale {
  if (unit.purpose === "establish") return "wide";
  if (unit.purpose === "reveal" || unit.purpose === "detail") return "extreme_close_up";
  if (unit.purpose === "reaction") return "close_up";
  if (unit.purpose === "transition") return "medium";
  return "medium";
}

function inferAngle(unit: VisualActionUnit): SuggestedShotAngle {
  if (unit.object === "账本" || unit.object === "土壤" || /俯|地面|裸土/.test(unit.visibleAction)) {
    return "top_down";
  }
  if (unit.purpose === "establish") return "eye_level";
  return "eye_level";
}

function buildCamera(unit: VisualActionUnit, prev?: VisualActionUnit): string {
  let scale = inferScale(unit);
  let angle = inferAngle(unit);

  if (prev) {
    const prevScale = inferScale(prev);
    const prevAngle = inferAngle(prev);
    if (prevScale === scale && prevAngle === angle) {
      if (scale === "medium") scale = "close_up";
      else if (scale === "close_up") scale = "medium";
      else if (scale === "wide") scale = "medium";
    }
  }

  return `${ANGLE_LABEL[angle]}${SCALE_LABEL[scale]}`;
}

export type RawNarrativeShot = Omit<
  import("./types").NarrativeShot,
  "shotId" | "sceneNumber" | "duration"
> & { sourceUnitIds?: string[] };

function shotCharacter(unit: VisualActionUnit, beat: NarrativeBeat): string {
  if (unit.purpose === "reaction" && unit.reaction?.subject) {
    return unit.reaction.subject;
  }
  if (unit.subject === "妻子" || unit.subject === "邻居们" || unit.subject === "邻居") {
    return unit.subject;
  }
  return unit.subject || beat.characters[0] || "未指定";
}

function shotReaction(unit: VisualActionUnit): string {
  return unit.reaction?.visibleBehavior ?? "";
}

function unitToShot(unit: VisualActionUnit, beat: NarrativeBeat, prev?: VisualActionUnit): RawNarrativeShot {
  const environment =
    unit.location ??
    (beat.environment && beat.environment !== "未指定" ? beat.environment : "场景");

  return {
    beatId: beat.beatId,
    character: shotCharacter(unit, beat),
    action: unit.visibleAction,
    reaction: shotReaction(unit),
    environment,
    camera: buildCamera(unit, prev),
    visualFocus: unit.visualFocus,
    shotPurpose: purposeLabel(unit.purpose),
    narration: "",
    narrationRef: beat.beatId,
    transition: "Cut",
    sourceUnitIds: [unit.unitId],
  };
}

function canMergeUnits(a: VisualActionUnit, b: VisualActionUnit): boolean {
  if (a.evidenceOf !== b.evidenceOf && a.sourceRef !== b.sourceRef) return false;
  if (a.object && a.object === b.object && a.object === "账本") {
    if (
      (a.purpose === "action" && b.purpose === "detail") ||
      (a.purpose === "detail" && b.purpose === "detail")
    ) {
      return true;
    }
  }
  if (
    a.subject === b.subject &&
    a.purpose === "action" &&
    b.purpose === "detail" &&
    /翻|看|观察/.test(a.visibleAction) &&
    /停|指|握/.test(b.visibleAction)
  ) {
    return true;
  }
  return false;
}

function mergeUnitsToShot(
  units: VisualActionUnit[],
  beat: NarrativeBeat,
  prev?: VisualActionUnit,
): RawNarrativeShot {
  const primary = units[0]!;
  const secondary = units[1]!;
  const environment =
    primary.location ??
    (beat.environment && beat.environment !== "未指定" ? beat.environment : "场景");

  const combinedAction =
    primary.object === "账本"
      ? `${primary.subject}翻账本后手指停在欠款数字`
      : `${primary.visibleAction}后${secondary.visibleAction.replace(new RegExp(`^${primary.subject}`), "")}`.slice(
          0,
          30,
        );
  const merged: VisualActionUnit = {
    ...primary,
    visibleAction: combinedAction,
    visualFocus: secondary.visualFocus || primary.visualFocus,
    purpose: secondary.purpose === "detail" ? "detail" : primary.purpose,
  };

  return {
    beatId: beat.beatId,
    character: shotCharacter(merged, beat),
    action: combinedAction,
    reaction: shotReaction(secondary) || shotReaction(primary),
    environment,
    camera: buildCamera(merged, prev),
    visualFocus: merged.visualFocus,
    shotPurpose: purposeLabel(merged.purpose),
    narration: "",
    narrationRef: beat.beatId,
    transition: "Cut",
    sourceUnitIds: units.map((u) => u.unitId),
  };
}

function splitUnitByConjunction(unit: VisualActionUnit): VisualActionUnit[] {
  const m = unit.visibleAction.match(/^(.{2,14})并(.{2,14})$/);
  if (!m) return [unit];
  return [
    { ...unit, unitId: `${unit.unitId}_a`, visibleAction: m[1]! },
    { ...unit, unitId: `${unit.unitId}_b`, visibleAction: m[2]! },
  ];
}

/** Shot Director：VisualActionUnit[] → NarrativeShot[]（非强制 1:1） */
export function directShotsFromUnits(
  units: VisualActionUnit[],
  beat: NarrativeBeat,
  _previousShots?: RawNarrativeShot[],
): RawNarrativeShot[] {
  const shots: RawNarrativeShot[] = [];
  let prev: VisualActionUnit | undefined;
  let i = 0;

  while (i < units.length) {
    const unit = units[i]!;
    const next = units[i + 1];

    if (next && canMergeUnits(unit, next)) {
      shots.push(mergeUnitsToShot([unit, next], beat, prev));
      prev = next;
      i += 2;
      continue;
    }

    const split = splitUnitByConjunction(unit);
    if (split.length > 1) {
      for (const part of split) {
        shots.push(unitToShot(part, beat, prev));
        prev = part;
      }
      i++;
      continue;
    }

    shots.push(unitToShot(unit, beat, prev));
    prev = unit;
    i++;
  }

  return shots;
}

export function focusCategory(focus: string): string {
  if (/眼|神|面部|表情|目光/.test(focus)) return "face";
  if (/手|指|握|伸|翻/.test(focus)) return "hand";
  if (/果|苹果|果皮|果实/.test(focus)) return "object";
  if (/篱笆|人群|山坡|晨雾/.test(focus)) return "environment";
  if (/叶|树|枝|根|昆虫|土壤/.test(focus)) return "nature";
  if (/账本|钞票|资料|喷雾器|阀门/.test(focus)) return "prop";
  return "other";
}

export function shotScaleFromCamera(camera: string): string {
  if (/大远景/.test(camera)) return "extreme_wide";
  if (/广角全景/.test(camera)) return "wide";
  if (/大特写/.test(camera)) return "extreme_close_up";
  if (/近景|特写/.test(camera)) return "close_up";
  return "medium";
}

export function shotAngleFromCamera(camera: string): string {
  if (/仰拍/.test(camera)) return "low";
  if (/俯拍/.test(camera)) return "high";
  if (/过肩/.test(camera)) return "over_shoulder";
  if (/主观/.test(camera)) return "pov";
  if (/垂直俯拍/.test(camera)) return "top_down";
  return "eye_level";
}
