"use client";

import type { EditPlanVariant } from "@/app/lib/auto-edit/edit-graph/types";
import { extractShotDecisions } from "@/app/lib/auto-edit/engines/ai-decision";
import { transitionTypeLabel } from "@/app/lib/auto-edit";

type Props = {
  plan: EditPlanVariant | null | undefined;
};

/** Phase 2：AI 为什么这样剪 */
export default function AiDecisionPanel({ plan }: Props) {
  if (!plan) {
    return (
      <p className="text-[10px] text-[var(--text-caption)]">
        生成 AI 方案后，将显示每镜时长建议与剪辑原因。
      </p>
    );
  }

  const decisions = extractShotDecisions(plan.sequence, plan.sequence);
  const withReason = decisions.filter((d) => d.reason && d.reason !== "默认分镜时长");

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-[var(--text-primary)]">AI 决策 · 为什么这样剪</p>
      {withReason.length === 0 ? (
        <p className="text-[10px] text-[var(--text-caption)]">暂无逐镜说明，请重新生成 AI 方案。</p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto overscroll-y-contain">
          {withReason.slice(0, 12).map((d) => (
            <li
              key={d.key}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5"
            >
              <p className="text-[10px] font-semibold text-[var(--accent)]">
                镜头 {d.shotIndex + 1}
                {d.suggestedDurationSec != null && (
                  <span className="ml-1 font-normal text-[var(--text-secondary)]">
                    建议 {d.suggestedDurationSec.toFixed(1)} 秒
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--text-secondary)]">
                {d.reason}
              </p>
              {d.tags && d.tags.length > 0 && (
                <p className="mt-1 text-[9px] text-[var(--text-caption)]">
                  {d.tags.join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {plan.timeline.transitions.some((t) => t.type !== "cut") && (
        <div className="rounded-lg bg-[var(--bg-inset)] p-2 text-[10px] text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text-primary)]">转场</p>
          <ul className="mt-1 space-y-0.5">
            {plan.timeline.transitions
              .filter((t) => t.type !== "cut")
              .slice(0, 6)
              .map((t) => {
                const clip = plan.timeline.video.find((v) => v.id === t.afterClipId);
                const idx = plan.timeline.video.findIndex((v) => v.id === t.afterClipId);
                const next = idx >= 0 ? plan.timeline.video[idx + 1] : undefined;
                const trKey =
                  clip?.sourceKey && next?.sourceKey
                    ? `${clip.sourceKey}->${next.sourceKey}`
                    : t.afterClipId;
                const rationale =
                  t.rationale ?? plan.rationale.perTransition[trKey] ?? plan.rationale.perTransition[t.afterClipId];
                return (
                  <li key={t.id}>
                    {transitionTypeLabel(t.type)}
                    {rationale ? ` · ${rationale}` : ""}
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}
