"use client";

import type { ShotLockRecord } from "@/app/lib/shot-lock";

type Props = {
  lock: ShotLockRecord | null;
  onUnlock?: () => void;
};

export default function ShotLockPanel({ lock, onUnlock }: Props) {
  if (!lock) {
    return (
      <div className="glass-panel rounded-xl p-4 text-sm text-[var(--text-muted)]">
        尚未锁定镜头。完成 3s 测试后可确认并锁定 Shot Lock。
      </div>
    );
  }

  const s = lock.snapshot;
  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">
          Shot Lock
        </h3>
        {onUnlock && (
          <button
            type="button"
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            onClick={onUnlock}
          >
            解锁
          </button>
        )}
      </div>
      <dl className="grid gap-1 text-xs text-[var(--text-muted)]">
        <div>
          <dt className="inline font-medium">ShotID: </dt>
          <dd className="inline">{s.shotId}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Seed: </dt>
          <dd className="inline">{s.seed}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Model: </dt>
          <dd className="inline">{s.model}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Duration: </dt>
          <dd className="inline">{s.duration}s</dd>
        </div>
        <div>
          <dt className="inline font-medium">Prompt: </dt>
          <dd className="mt-1 line-clamp-3">{s.prompt}</dd>
        </div>
      </dl>
      {s.firstFrameUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={s.firstFrameUrl}
          alt="First frame"
          className="mt-3 max-h-32 rounded-lg object-cover"
        />
      )}
    </div>
  );
}
