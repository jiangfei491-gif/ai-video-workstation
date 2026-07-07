"use client";

import { useMemo } from "react";
import { FiLoader, FiRefreshCw } from "react-icons/fi";
import type { ScriptSegment } from "@/app/lib/auto-edit/edit-graph/types";
import type { ScriptPanelView } from "@/app/lib/workbench-persist/types";

type Props = {
  fullScript: string;
  scriptSourceLabel?: string | null;
  scriptView: ScriptPanelView;
  onScriptViewChange: (view: ScriptPanelView) => void;
  scriptMap: ScriptSegment[];
  activeShotIndex: number | null;
  playheadSec: number;
  alignLoading?: boolean;
  onSelectSegment: (seg: ScriptSegment) => void;
  onAlignScript?: () => void;
};

export default function ScriptPanel({
  fullScript,
  scriptSourceLabel,
  scriptView,
  onScriptViewChange,
  scriptMap,
  activeShotIndex,
  playheadSec,
  alignLoading,
  onSelectSegment,
  onAlignScript,
}: Props) {
  const view = scriptView;
  const scriptCharCount = fullScript.replace(/\s/g, "").length;

  const shotSegments = useMemo(
    () => scriptMap.filter((s) => s.source === "storyboard" || s.source === undefined),
    [scriptMap]
  );
  const aiSegments = useMemo(() => scriptMap.filter((s) => s.source === "ai"), [scriptMap]);
  const scriptSegments = useMemo(
    () => scriptMap.filter((s) => s.source === "script"),
    [scriptMap]
  );

  const displayList =
    view === "shot"
      ? shotSegments.length > 0
        ? shotSegments
        : scriptMap
      : view === "ai"
        ? aiSegments.length > 0
          ? aiSegments
          : scriptSegments
        : scriptSegments.length > 0
          ? scriptSegments
          : scriptMap;

  if (!fullScript.trim() && scriptMap.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-xs text-[var(--text-caption)]">
        暂无脚本，请先在创作中心运行编导
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[var(--border)] px-3 py-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">脚本</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {(
            [
              ["shot", "按镜头"],
              ["full", "全文"],
              ["ai", "AI 对齐"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onScriptViewChange(id)}
              className={`option-chip px-2 py-0.5 text-xs ${
                view === id ? "option-chip-active" : ""
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {view === "ai" && onAlignScript && (
          <button
            type="button"
            disabled={alignLoading}
            onClick={onAlignScript}
            className="btn-secondary mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] disabled:opacity-50"
          >
            {alignLoading ? (
              <FiLoader className="h-3 w-3 animate-spin" />
            ) : (
              <FiRefreshCw className="h-3 w-3" />
            )}
            AI 对齐全文到镜头
          </button>
        )}
        <p className="mt-1.5 text-xs text-[var(--text-caption)]">
          {view === "shot"
            ? "按镜头显示分镜旁白（非全文）；完整稿请切到「全文」"
            : view === "full"
              ? "完整脚本文本，与素材池 / 编导一致"
              : "点击句子可定位画布镜头"}
        </p>
      </div>
      <div className="h-0 min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3">
        {view === "full" && fullScript.trim() ? (
          <div className="space-y-2">
            {scriptSourceLabel && (
              <p className="text-[10px] text-[var(--text-caption)]">
                来源：{scriptSourceLabel}
                {scriptCharCount > 0 && ` · 共 ${scriptCharCount.toLocaleString()} 字`}
              </p>
            )}
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--text-secondary)]">
              {fullScript}
            </pre>
          </div>
        ) : view === "full" && !fullScript.trim() ? (
          <p className="text-xs text-[var(--text-caption)]">
            暂无完整脚本文本。请从内容中心导入，或在创作中心运行编导。
          </p>
        ) : displayList.length > 0 ? (
          <ul className="space-y-2">
            {displayList.map((seg) => {
              const active =
                seg.shotIndex !== undefined && seg.shotIndex === activeShotIndex;
              const atPlayhead =
                seg.timelineStartSec !== undefined &&
                playheadSec >= seg.timelineStartSec &&
                playheadSec < seg.timelineStartSec + 8;
              return (
                <li key={seg.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSegment(seg)}
                    className={`w-full rounded-lg border px-2.5 py-2 text-left text-xs leading-relaxed transition-colors ${
                      active || atPlayhead
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]"
                        : "border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40"
                    }`}
                  >
                    {seg.shotIndex !== undefined && (
                      <span className="mb-1 inline-block rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--accent)]">
                        镜 {seg.shotIndex + 1}
                      </span>
                    )}
                    {seg.source === "ai" && (
                      <span className="mb-1 ml-1 inline-block rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[9px] text-[var(--text-caption)]">
                        AI
                      </span>
                    )}
                    <p>{seg.text}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-[var(--text-caption)]">暂无内容，可切换视图或运行 AI 对齐</p>
        )}
      </div>
    </div>
  );
}
