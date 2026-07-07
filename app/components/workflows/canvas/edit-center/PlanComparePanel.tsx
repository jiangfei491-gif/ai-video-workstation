"use client";

import type { EditPlanVariant } from "@/app/lib/auto-edit/edit-graph/types";
import { transitionTypeLabel } from "@/app/lib/auto-edit";
import type { TransitionType } from "@/app/lib/auto-edit/types";

type Props = {
  plans: EditPlanVariant[];
  activePlanId: string | null;
};

export default function PlanComparePanel({ plans, activePlanId }: Props) {
  if (plans.length < 2) {
    return (
      <p className="text-[10px] text-[var(--text-caption)]">
        生成至少 2 个 AI 方案后可对比时长与转场差异。
      </p>
    );
  }

  const sorted = [...plans].slice(-3);
  const active = sorted.find((p) => p.id === activePlanId) ?? sorted[sorted.length - 1];
  const baseline = sorted.find((p) => p.id !== active.id) ?? sorted[0];

  const activeDur = active.timeline.durationSec;
  const baseDur = baseline.timeline.durationSec;
  const durDelta = activeDur - baseDur;

  const activeTransitions = active.timeline.transitions.filter((t) => t.type !== "cut").length;
  const baseTransitions = baseline.timeline.transitions.filter((t) => t.type !== "cut").length;

  const shotDiffs: { shot: number; a: number; b: number }[] = [];
  const aVideos = [...active.timeline.video].sort((x, y) => x.startSec - y.startSec);
  const bVideos = [...baseline.timeline.video].sort((x, y) => x.startSec - y.startSec);
  const len = Math.min(aVideos.length, bVideos.length);
  for (let i = 0; i < len; i++) {
    const da = aVideos[i].durationSec;
    const db = bVideos[i].durationSec;
    if (Math.abs(da - db) > 0.2) {
      shotDiffs.push({
        shot: (aVideos[i].video?.shotIndex ?? i) + 1,
        a: da,
        b: db,
      });
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
      <p className="text-[10px] font-semibold text-[var(--text-primary)]">方案对比</p>
      <div className="grid grid-cols-2 gap-2 text-[9px]">
        <div className="rounded bg-[var(--bg-surface)] p-2">
          <p className="font-medium text-[var(--accent)]">{active.name}</p>
          <p className="mt-1 text-[var(--text-secondary)]">{activeDur.toFixed(1)} 秒</p>
          <p className="text-[var(--text-caption)]">{activeTransitions} 处转场</p>
        </div>
        <div className="rounded bg-[var(--bg-surface)] p-2">
          <p className="font-medium">{baseline.name}</p>
          <p className="mt-1 text-[var(--text-secondary)]">{baseDur.toFixed(1)} 秒</p>
          <p className="text-[var(--text-caption)]">{baseTransitions} 处转场</p>
        </div>
      </div>
      <p className="text-[9px] text-[var(--text-secondary)]">
        总时长差 {durDelta >= 0 ? "+" : ""}
        {durDelta.toFixed(1)} 秒 · 镜长差异 {shotDiffs.length} 处
      </p>
      {shotDiffs.length > 0 && (
        <ul className="max-h-20 space-y-0.5 overflow-y-auto text-[9px] text-[var(--text-caption)]">
          {shotDiffs.slice(0, 6).map((d) => (
            <li key={d.shot}>
              镜 {d.shot}：{d.a.toFixed(1)}s vs {d.b.toFixed(1)}s
            </li>
          ))}
        </ul>
      )}
      {active.timeline.transitions.some((t) => t.type !== "cut") && (
        <p className="text-[9px] text-[var(--text-caption)]">
          当前方案转场：
          {active.timeline.transitions
            .filter((t) => t.type !== "cut")
            .slice(0, 3)
            .map((t) => transitionTypeLabel(t.type as TransitionType))
            .join("、")}
        </p>
      )}
    </div>
  );
}
