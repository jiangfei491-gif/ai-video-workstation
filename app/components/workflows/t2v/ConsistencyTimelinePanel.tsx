"use client";

import { useEffect, useState } from "react";
import type { ShotTimelineEntry } from "@/app/lib/consistency-engine/types/world-style-camera";

type Props = {
  activeShotIdx: number;
  shotTimeline: Record<number, ShotTimelineEntry>;
  onSelectShot: (index: number) => void;
  total: number;
};

type EngineInfo = {
  version: string;
  progress: { pct: number };
  recommendedModel: Record<string, string>;
};

export default function ConsistencyTimelinePanel({
  activeShotIdx,
  shotTimeline,
  onSelectShot,
  total,
}: Props) {
  const [engine, setEngine] = useState<EngineInfo | null>(null);

  useEffect(() => {
    fetch("/api/consistency-engine")
      .then((r) => r.json())
      .then((d) => setEngine(d))
      .catch(() => {});
  }, []);

  const prev = activeShotIdx > 0 ? shotTimeline[activeShotIdx - 1] : null;
  const cur = shotTimeline[activeShotIdx];

  return (
    <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]">
      <p className="workbench-label mb-3">一致性时间轴</p>
      <div className="mb-3 flex flex-wrap gap-1">
        {Array.from({ length: total }, (_, i) => {
          const entry = shotTimeline[i];
          const qc = entry?.qc;
          const color = !entry
            ? "bg-[var(--bg-inset)] text-[var(--text-caption)]"
            : qc?.passed === false
              ? "bg-[var(--danger-soft)] text-[var(--danger)]"
              : "bg-[var(--accent-soft)] text-[var(--accent)]";
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectShot(i)}
              className={`rounded-md px-2 py-1 text-[10px] font-medium ${color} ${
                i === activeShotIdx ? "ring-1 ring-[var(--accent)]" : ""
              }`}
            >
              {i + 1}
              {qc ? ` · ${qc.scores.overall}` : ""}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-[var(--bg-inset)] p-3">
          <p className="mb-1 text-[10px] font-medium text-[var(--text-caption)]">
            上一镜 {activeShotIdx > 0 ? `#${activeShotIdx}` : "—"}
          </p>
          {prev ? (
            <div className="space-y-1 text-[10px] text-[var(--text-secondary)]">
              {prev.qc && (
                <p>
                  QC {prev.qc.scores.overall} · 人物 {prev.qc.scores.character} · 场景{" "}
                  {prev.qc.scores.scene}
                </p>
              )}
              <p className="line-clamp-3">{prev.deltaChanges.join(" · ") || "—"}</p>
            </div>
          ) : (
            <p className="text-[10px] text-[var(--text-caption)]">首镜，无继承</p>
          )}
        </div>
        <div className="rounded-lg bg-[var(--bg-inset)] p-3">
          <p className="mb-1 text-[10px] font-medium text-[var(--text-caption)]">
            当前镜 #{activeShotIdx + 1}
          </p>
          {cur ? (
            <div className="space-y-1 text-[10px] text-[var(--text-secondary)]">
              {cur.score && (
                <p className={cur.score.passed ? "text-[var(--accent)]" : "text-[var(--danger)]"}>
                  评分 {cur.score.scores.composite}
                  {cur.upgradedToPremium ? " · 已 GPT 精修" : " · FLUX 草稿"}
                  {cur.totalCostUsd != null ? ` · $${cur.totalCostUsd.toFixed(4)}` : ""}
                </p>
              )}
              {cur.qc && (
                <p className={cur.qc.passed ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                  QC {cur.qc.scores.overall}
                  {cur.repairAttempts > 0 ? ` · 修复 ${cur.repairAttempts} 次` : ""}
                </p>
              )}
              <p className="line-clamp-3">{cur.deltaChanges.join(" · ") || "—"}</p>
            </div>
          ) : (
            <p className="text-[10px] text-[var(--text-caption)]">尚未生成</p>
          )}
        </div>
      </div>

      {engine && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border)]/30 pt-3 text-[10px] text-[var(--text-caption)]">
          <span>
            Consistency Engine v{engine.version} · {engine.progress.pct}% 就绪
          </span>
          <span>
            推荐模型：纪录片 {engine.recommendedModel.documentary} · 人物{" "}
            {engine.recommendedModel.character}
          </span>
        </div>
      )}
    </div>
  );
}
