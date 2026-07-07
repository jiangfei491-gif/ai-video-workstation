"use client";

import type { EditTimeline, TimelineClip } from "@/app/lib/auto-edit/edit-graph/types";

const BASE_PX_PER_SEC = 36;

const TRACK_META = {
  video: { label: "画面", color: "bg-[var(--accent-soft)]", border: "border-[var(--accent)]/25" },
  voice: { label: "配音", color: "bg-emerald-500/10", border: "border-emerald-500/25" },
  music: { label: "音乐", color: "bg-amber-500/10", border: "border-amber-500/25" },
  subtitle: { label: "字幕", color: "bg-violet-500/10", border: "border-violet-500/25" },
} as const;

type Props = {
  timeline: EditTimeline;
  sections: { id: string; title: string }[];
  activeClipId: string | null;
  playheadSec: number;
  dragIdx: number | null;
  onDragIdx: (i: number | null) => void;
  onReorder: (from: number, to: number) => void;
  onDurationChange: (clipId: string, sec: number) => void;
  onSelectClip: (clip: TimelineClip) => void;
  onSeek: (sec: number) => void;
  pxScale?: number;
  hideHeader?: boolean;
};

function TrackRow({
  label,
  clips,
  trackColor,
  trackBorder,
  activeClipId,
  editable,
  onSelectClip,
  onDurationChange,
  dragIdx,
  onDragIdx,
  onReorder,
  pxScale = 1,
}: {
  label: string;
  clips: TimelineClip[];
  trackColor: string;
  trackBorder: string;
  activeClipId: string | null;
  editable?: boolean;
  onSelectClip: (c: TimelineClip) => void;
  onDurationChange?: (clipId: string, sec: number) => void;
  dragIdx?: number | null;
  onDragIdx?: (i: number | null) => void;
  onReorder?: (from: number, to: number) => void;
  pxScale?: number;
}) {
  const pxPerSec = BASE_PX_PER_SEC * pxScale;
  return (
    <div className="flex min-w-max items-stretch gap-2 py-1">
      <div className="sticky left-0 z-10 flex w-16 shrink-0 items-center bg-[var(--bg-surface)] pr-2 text-xs font-medium text-[var(--text-caption)]">
        {label}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {clips.length === 0 ? (
          <div className="edit-timeline-empty">空轨</div>
        ) : (
          clips.map((clip, idx) => {
            const w = Math.max(48, clip.durationSec * pxPerSec);
            const active = clip.id === activeClipId;
            const isVideo = clip.track === "video";
            const missing = clip.video?.sourceKind === "missing";
            return (
              <div
                key={clip.id}
                draggable={editable && isVideo}
                onDragStart={() => editable && onDragIdx?.(idx)}
                onDragOver={(e) => editable && e.preventDefault()}
                onDrop={() => {
                  if (editable && dragIdx !== null && dragIdx !== undefined && dragIdx !== idx) {
                    onReorder?.(dragIdx, idx);
                  }
                  onDragIdx?.(null);
                }}
                onClick={() => onSelectClip(clip)}
                className={`edit-timeline-clip group ${trackColor} ${trackBorder} ${
                  active ? "edit-timeline-clip-active" : ""
                } ${missing ? "edit-timeline-clip-missing" : ""} ${
                  editable && isVideo ? "cursor-grab active:cursor-grabbing" : ""
                }`}
                style={{ width: w }}
                title={clip.label}
              >
                <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                  {clip.label}
                </p>
                {clip.subtitle?.text && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-caption)]">
                    {clip.subtitle.text}
                  </p>
                )}
                {editable && isVideo && onDurationChange ? (
                  <input
                    type="number"
                    min={0.5}
                    max={15}
                    step={0.5}
                    value={clip.durationSec}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      onDurationChange(clip.id, Number(e.target.value) || 1)
                    }
                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-surface)] px-1 text-xs"
                  />
                ) : (
                  <p className="mt-0.5 text-xs text-[var(--text-caption)]">
                    {clip.durationSec.toFixed(1)}s
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function MultiTrackTimeline({
  timeline,
  sections,
  activeClipId,
  playheadSec,
  dragIdx,
  onDragIdx,
  onReorder,
  onDurationChange,
  onSelectClip,
  onSeek,
  pxScale = 1,
  hideHeader = false,
}: Props) {
  const pxPerSec = BASE_PX_PER_SEC * pxScale;
  const rulerW = Math.max(timeline.durationSec * pxPerSec, 240);
  const tickStep = timeline.durationSec > 120 ? 10 : timeline.durationSec > 60 ? 5 : 2;
  const ticks: number[] = [];
  for (let t = 0; t <= timeline.durationSec; t += tickStep) ticks.push(t);

  return (
    <div className="edit-timeline flex h-full min-h-0 flex-col bg-[var(--bg-surface)]">
      {!hideHeader && (
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-strong)] px-4 py-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">时间轴</p>
        <p className="font-mono text-xs tabular-nums text-[var(--text-caption)]">
          {playheadSec.toFixed(1)}s / {timeline.durationSec.toFixed(1)}s
        </p>
      </div>
      )}
      <div className="relative min-h-0 flex-1 overflow-auto p-3">
        <div className="relative min-w-max" style={{ width: rulerW + 72 }}>
          {sections.length > 0 && (
            <div className="mb-2 flex pl-16 gap-1">
              {sections.map((s) => (
                <span
                  key={s.id}
                  className="rounded-md bg-[var(--bg-inset)] px-2 py-0.5 text-xs text-[var(--text-caption)]"
                >
                  {s.title}
                </span>
              ))}
            </div>
          )}
          <div
            className="relative mb-1 h-6 cursor-pointer pl-16"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              onSeek(Math.max(0, x / pxPerSec));
            }}
          >
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute top-0 text-[10px] tabular-nums text-[var(--text-caption)]"
                style={{ left: t * pxPerSec }}
              >
                {t}s
              </span>
            ))}
            <div
              className="edit-playhead absolute top-0 z-20 h-full w-0.5 bg-[var(--accent)]"
              style={{ left: playheadSec * pxPerSec }}
            >
              <div className="absolute -left-1.5 -top-0.5 h-3 w-3 rounded-full bg-[var(--accent)] shadow" />
            </div>
          </div>
          <div className="space-y-1 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-inset)] p-2.5">
            <TrackRow
              label={TRACK_META.video.label}
              clips={timeline.video}
              trackColor={TRACK_META.video.color}
              trackBorder={TRACK_META.video.border}
              activeClipId={activeClipId}
              editable
              dragIdx={dragIdx}
              onDragIdx={onDragIdx}
              onReorder={onReorder}
              onSelectClip={onSelectClip}
              onDurationChange={onDurationChange}
              pxScale={pxScale}
            />
            <TrackRow
              label={TRACK_META.voice.label}
              clips={timeline.voice}
              trackColor={TRACK_META.voice.color}
              trackBorder={TRACK_META.voice.border}
              activeClipId={activeClipId}
              onSelectClip={onSelectClip}
              pxScale={pxScale}
            />
            <TrackRow
              label={TRACK_META.music.label}
              clips={timeline.music}
              trackColor={TRACK_META.music.color}
              trackBorder={TRACK_META.music.border}
              activeClipId={activeClipId}
              onSelectClip={onSelectClip}
              pxScale={pxScale}
            />
            <TrackRow
              label={TRACK_META.subtitle.label}
              clips={timeline.subtitle}
              trackColor={TRACK_META.subtitle.color}
              trackBorder={TRACK_META.subtitle.border}
              activeClipId={activeClipId}
              onSelectClip={onSelectClip}
              pxScale={pxScale}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
