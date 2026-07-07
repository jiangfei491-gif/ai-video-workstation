"use client";

import { useMemo } from "react";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import type { EditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";
import {
  buildStoryGraphFromWorkbench,
  checkContinuity,
  suggestBeatSync,
  suggestFillShots,
} from "@/app/lib/auto-edit/engines/story-graph";
import { buildTakesForShot } from "@/app/lib/auto-edit/engines/take-scoring";
import LoadingButton from "@/app/components/workflows/shared/LoadingButton";

type Props = {
  state: T2VWorkbenchState;
  engineSettings: EditEngineSettings;
  beatApplyLoading?: boolean;
  onBpmChange: (bpm: number) => void;
  onApplyBeatSync: () => void;
  onFocusShot?: (shotIndex: number) => void;
};

export default function StoryGraphPanel({
  state,
  engineSettings,
  beatApplyLoading = false,
  onBpmChange,
  onApplyBeatSync,
  onFocusShot,
}: Props) {
  const bpm = engineSettings.storyGraph.bpm;
  const graph = useMemo(() => buildStoryGraphFromWorkbench(state), [state]);
  const issues = useMemo(() => checkContinuity(state), [state]);
  const fillShots = useMemo(() => suggestFillShots(state), [state]);
  const beatHints = useMemo(() => {
    const clips = state.editGraph?.timeline.video ?? [];
    return suggestBeatSync(
      bpm,
      clips.map((c) => ({ clipId: c.id, startSec: c.startSec }))
    );
  }, [state.editGraph?.timeline.video, bpm]);

  const takePreview = useMemo(() => {
    const idx = state.activeShotIdx ?? 0;
    return buildTakesForShot(
      idx,
      state.batchResults[idx],
      state.shotFrames[idx]
    );
  }, [state.activeShotIdx, state.batchResults, state.shotFrames]);

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-primary)]">Story Graph</p>
        <p className="mt-1 text-[9px] text-[var(--text-caption)]">
          {graph.nodes.length} 节点 · {graph.edges.length} 边（含播放路径）
        </p>
        <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto text-[9px] text-[var(--text-secondary)]">
          {graph.nodes.slice(0, 14).map((n) => (
            <li key={n.id}>
              <span className="text-[var(--text-caption)]">{n.kind}</span> · {n.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-primary)]">BPM 卡点</p>
        <label className="mt-2 block text-[9px] text-[var(--text-caption)]">
          BPM
          <input
            type="number"
            min={60}
            max={200}
            value={bpm}
            onChange={(e) => onBpmChange(Number(e.target.value) || 120)}
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
          />
        </label>
        {beatHints.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-[9px] text-[var(--text-secondary)]">
            {beatHints.slice(0, 3).map((b, i) => (
              <li key={i}>{b.reason}</li>
            ))}
          </ul>
        )}
        <LoadingButton
          variant="secondary"
          loading={beatApplyLoading}
          loadingText="对齐中…"
          onClick={onApplyBeatSync}
          className="mt-2 w-full text-xs"
        >
          应用 BPM 对齐镜长
        </LoadingButton>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-primary)]">Multi-Take 评分</p>
        {takePreview.length === 0 ? (
          <p className="mt-1 text-[9px] text-[var(--text-caption)]">当前镜头暂无 Take</p>
        ) : (
          <ul className="mt-2 space-y-1 text-[9px]">
            {takePreview.map((t) => (
              <li
                key={t.id}
                className={`rounded px-2 py-1 ${t.selected ? "bg-[var(--accent-soft)]" : "bg-[var(--bg-surface)]"}`}
              >
                {t.label} · 总分 {t.scores.total}
                {t.selected && " · 推荐"}
              </li>
            ))}
          </ul>
        )}
      </section>

      {issues.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
          <p className="text-[10px] font-semibold text-[var(--text-primary)]">连续性检查</p>
          <ul className="mt-2 space-y-1 text-[9px]">
            {issues.slice(0, 8).map((i, idx) => (
              <li
                key={idx}
                className={i.severity === "error" ? "text-[var(--danger)]" : "text-[var(--warning)]"}
              >
                {i.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {fillShots.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
          <p className="text-[10px] font-semibold text-[var(--text-primary)]">自动补镜建议</p>
          <ul className="mt-2 space-y-1.5 text-[9px] text-[var(--text-secondary)]">
            {fillShots.slice(0, 6).map((s) => (
              <li key={s.shotIndex} className="flex items-center justify-between gap-2">
                <span>
                  镜 {s.shotIndex + 1} · {s.reason}
                </span>
                {onFocusShot && (
                  <button
                    type="button"
                    onClick={() => onFocusShot(s.shotIndex)}
                    className="shrink-0 text-[var(--accent)]"
                  >
                    跳转
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
