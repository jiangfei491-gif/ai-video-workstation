"use client";

import type { EditPlanVariant, MediaPoolItem, TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";
import { transitionTypeLabel } from "@/app/lib/auto-edit";
import type { TransitionType } from "@/app/lib/auto-edit/types";
import { TRANSITION_ENGINE_OPTIONS } from "@/app/lib/auto-edit/engines/transition-engine/ffmpeg-xfade";

type TransitionInfo = {
  type: string;
  durationMs?: number;
  rationale?: string;
};

type Props = {
  clip: TimelineClip | null;
  mediaItem: MediaPoolItem | null;
  activePlan: EditPlanVariant | undefined;
  transitionAfter: TransitionInfo | null;
  onTransitionChange?: (patch: { type: TransitionType; durationMs: number }) => void;
};

export default function EditInspectorPanel({
  clip,
  mediaItem,
  activePlan,
  transitionAfter,
  onTransitionChange,
}: Props) {
  if (!clip) {
    return (
      <div className="edit-inspector-empty rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-inset)] px-4 py-6 text-center">
        <p className="text-sm font-medium text-[var(--text-secondary)]">检查器</p>
        <p className="mt-1 text-xs text-[var(--text-caption)]">
          点击时间轴片段，查看镜头属性与 AI 剪辑理由
        </p>
      </div>
    );
  }

  const shotIndex = clip.video?.shotIndex;
  const shotKey = shotIndex !== undefined ? `shot-${shotIndex}` : clip.sourceKey;
  const aiReason =
    activePlan?.rationale.perShot[shotKey] ??
    activePlan?.rationale.perShot[clip.sourceKey] ??
    null;
  const missing = clip.video?.sourceKind === "missing";
  const canEditTransition = clip.track === "video" && Boolean(onTransitionChange);

  return (
    <div className="edit-inspector rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3">
      <div className="flex gap-3">
        {mediaItem?.url && mediaItem.kind !== "voice" && mediaItem.kind !== "subtitle-text" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaItem.url}
            alt=""
            className="h-16 w-24 shrink-0 rounded-lg object-cover ring-1 ring-[var(--border)]"
          />
        ) : (
          <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-inset)] text-xs text-[var(--text-caption)]">
            {clip.track === "voice" ? "配音" : clip.track === "subtitle" ? "字幕" : "无预览"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{clip.label}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {shotIndex !== undefined && (
              <span className="rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-xs font-medium text-[var(--accent)]">
                镜 {shotIndex + 1}
              </span>
            )}
            <span className="rounded-md bg-[var(--bg-inset)] px-1.5 py-0.5 text-xs text-[var(--text-caption)]">
              {clip.durationSec.toFixed(1)} 秒
            </span>
            {missing && (
              <span className="rounded-md bg-[var(--danger-soft)] px-1.5 py-0.5 text-xs text-[var(--danger)]">
                缺素材
              </span>
            )}
          </div>
          {clip.subtitle?.text && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              {clip.subtitle.text}
            </p>
          )}
        </div>
      </div>

      {canEditTransition && (
        <div className="mt-3 rounded-lg bg-[var(--bg-inset)] px-2.5 py-2">
          <p className="text-xs font-medium text-[var(--text-primary)]">转场（本镜 → 下一镜）</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block text-[10px] text-[var(--text-caption)]">
              类型
              <select
                value={transitionAfter?.type ?? "cut"}
                onChange={(e) => {
                  const type = e.target.value as TransitionType;
                  onTransitionChange?.({
                    type,
                    durationMs: type === "cut" ? 0 : (transitionAfter?.durationMs ?? 400),
                  });
                }}
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
              >
                {TRANSITION_ENGINE_OPTIONS.filter((t) => t.implemented).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] text-[var(--text-caption)]">
              时长 (ms)
              <input
                type="number"
                min={0}
                max={2000}
                disabled={(transitionAfter?.type ?? "cut") === "cut"}
                value={transitionAfter?.durationMs ?? 0}
                onChange={(e) =>
                  onTransitionChange?.({
                    type: (transitionAfter?.type ?? "crossfade") as TransitionType,
                    durationMs: Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
              />
            </label>
          </div>
          {transitionAfter?.rationale && (
            <p className="mt-1.5 text-[10px] text-[var(--text-caption)]">{transitionAfter.rationale}</p>
          )}
        </div>
      )}

      {!canEditTransition && transitionAfter && transitionAfter.type !== "cut" && (
        <div className="mt-3 rounded-lg bg-[var(--bg-inset)] px-2.5 py-2">
          <p className="text-xs font-medium text-[var(--text-primary)]">转场</p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {transitionTypeLabel(transitionAfter.type as TransitionType)}
            {transitionAfter.rationale ? ` · ${transitionAfter.rationale}` : ""}
          </p>
        </div>
      )}

      {aiReason && (
        <div className="mt-3 rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2.5 py-2">
          <p className="text-xs font-medium text-[var(--accent)]">AI 剪辑理由</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">{aiReason}</p>
        </div>
      )}
    </div>
  );
}
