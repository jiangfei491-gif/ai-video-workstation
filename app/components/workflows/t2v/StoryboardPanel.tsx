"use client";

import { FiArrowDown, FiArrowUp } from "react-icons/fi";
import type { DirectorState } from "@/app/lib/workbench-persist/types";

type Props = {
  director: DirectorState;
  activeShotIdx: number;
  onSelectShot: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onUpdatePrompt: (index: number, providerPrompt: string) => void;
};

export default function StoryboardPanel({
  director,
  activeShotIdx,
  onSelectShot,
  onReorder,
  onUpdatePrompt,
}: Props) {
  const { storyboard, prompts } = director;

  function moveShot(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= prompts.length) return;
    onReorder(index, next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {prompts.map((p, i) => (
          <button
            key={`${p.sceneNumber}-${i}`}
            type="button"
            onClick={() => onSelectShot(i)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              i === activeShotIdx ? "nav-item-active" : "btn-secondary"
            }`}
          >
            镜头 {i + 1}
          </button>
        ))}
      </div>

      {storyboard[activeShotIdx] && (
        <div className="rounded-lg border border-[var(--border)] p-4 text-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="workbench-label">分镜 #{activeShotIdx + 1}</p>
            <div className="flex gap-1">
              <button
                type="button"
                className="btn-secondary rounded p-1.5"
                disabled={activeShotIdx === 0}
                onClick={() => moveShot(activeShotIdx, -1)}
                title="上移"
              >
                <FiArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn-secondary rounded p-1.5"
                disabled={activeShotIdx >= prompts.length - 1}
                onClick={() => moveShot(activeShotIdx, 1)}
                title="下移"
              >
                <FiArrowDown className="h-4 w-4" />
              </button>
            </div>
          </div>
          <dl className="grid gap-2 text-[var(--text-secondary)]">
            <div>
              <dt className="text-xs text-[var(--text-caption)]">角色</dt>
              <dd>{storyboard[activeShotIdx].character || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-caption)]">动作</dt>
              <dd>{storyboard[activeShotIdx].action || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-caption)]">环境</dt>
              <dd>{storyboard[activeShotIdx].environment || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-caption)]">镜头</dt>
              <dd>{storyboard[activeShotIdx].camera || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-caption)]">旁白</dt>
              <dd>{storyboard[activeShotIdx].narration || "—"}</dd>
            </div>
          </dl>
        </div>
      )}

      <div>
        <label className="workbench-label mb-2 block">镜头描述（提示词）</label>
        <textarea
          className="input-field min-h-[120px] w-full rounded-lg px-3 py-2.5 text-sm leading-relaxed"
          value={prompts[activeShotIdx]?.providerPrompt ?? ""}
          onChange={(e) => onUpdatePrompt(activeShotIdx, e.target.value)}
        />
      </div>
    </div>
  );
}
