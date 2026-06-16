"use client";

import type { ShotLockRecord } from "@/app/lib/shot-lock";

type Props = {
  lock: ShotLockRecord | null;
  onUnlock?: () => void;
};

export default function ShotLockPanel({ lock, onUnlock }: Props) {
  if (!lock) {
    return (
      <div className="glass-panel rounded-xl p-4 text-sm text-[var(--text-caption)]">
        尚未锁定镜头。完成 3 秒测试后可确认并锁定。
      </div>
    );
  }

  const s = lock.snapshot;
  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          镜头锁定
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
      <dl className="grid gap-1 text-xs text-[var(--text-body)]">
        <div>
          <dt className="inline font-medium">镜头 ID：</dt>
          <dd className="inline">{s.shotId}</dd>
        </div>
        <div>
          <dt className="inline font-medium">随机种子：</dt>
          <dd className="inline">{s.seed}</dd>
        </div>
        <div>
          <dt className="inline font-medium">模型：</dt>
          <dd className="inline">{s.model}</dd>
        </div>
        <div>
          <dt className="inline font-medium">时长：</dt>
          <dd className="inline">{s.duration} 秒</dd>
        </div>
        <div>
          <dt className="inline font-medium">提示词：</dt>
          <dd className="mt-1 line-clamp-3">{s.prompt}</dd>
        </div>
      </dl>
      {s.firstFrameUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={s.firstFrameUrl}
          alt="首帧预览"
          className="mt-3 max-h-32 rounded-lg object-cover"
        />
      )}
    </div>
  );
}
