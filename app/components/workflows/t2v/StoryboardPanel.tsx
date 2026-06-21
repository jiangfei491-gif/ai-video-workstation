"use client";

import { useRef, useState } from "react";
import {
  FiArrowDown,
  FiArrowUp,
  FiEdit3,
  FiSliders,
  FiVideo,
  FiLoader,
  FiMove,
} from "react-icons/fi";
import PromptBuilder from "@/app/components/workflows/shared/PromptBuilder";
import CameraTrajectoryPanel from "@/app/components/workflows/shared/CameraTrajectoryPanel";
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
  // 默认「直接编辑」——编导已生成好提示词，先让用户看到/改它；
  // 「填空助手」是从零搭新提示词的可选增强（无法反向拆解已生成的英文 prompt）。
  const [mode, setMode] = useState<"builder" | "raw">("raw");
  const [videoExtracting, setVideoExtracting] = useState(false);
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoInput = useRef<HTMLInputElement>(null);

  // 把运镜指令追加到当前镜头提示词末尾
  function appendDirective(directive: string) {
    const cur = (prompts[activeShotIdx]?.providerPrompt ?? "").trim().replace(/\.\s*$/, "");
    const next = [cur, directive].filter(Boolean).join(", ") + ".";
    setMode("raw");
    onUpdatePrompt(activeShotIdx, next);
  }

  function moveShot(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= prompts.length) return;
    onReorder(index, next);
  }

  // 视频反推提示词：上传参考视频 → 抽帧 → GPT-4.1 视觉反推 → 写入当前镜头
  async function handleVideo(file: File | undefined | null) {
    if (!file || !file.type.startsWith("video/")) return;
    setVideoErr(null);
    setVideoExtracting(true);
    try {
      const fd = new FormData();
      fd.append("video", file);
      const res = await fetch("/api/director/extract-prompt-from-video", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "视频反推失败");
      setMode("raw");
      onUpdatePrompt(activeShotIdx, data.prompt as string);
    } catch (e) {
      setVideoErr(e instanceof Error ? e.message : String(e));
    } finally {
      setVideoExtracting(false);
      if (videoInput.current) videoInput.current.value = "";
    }
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
        <div className="mb-2 flex items-center justify-between">
          <label className="workbench-label">镜头描述（提示词）</label>
          <div className="flex gap-1 rounded-lg bg-[var(--bg-surface)] p-0.5">
            <button
              type="button"
              onClick={() => setMode("builder")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === "builder" ? "nav-item-active" : "text-[var(--text-secondary)]"
              }`}
            >
              <FiSliders className="h-3.5 w-3.5" />
              高级模式
            </button>
            <button
              type="button"
              onClick={() => setMode("raw")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === "raw" ? "nav-item-active" : "text-[var(--text-secondary)]"
              }`}
            >
              <FiEdit3 className="h-3.5 w-3.5" />
              修改提示词
            </button>
          </div>
        </div>

        <p className="mb-2 text-xs text-[var(--text-caption)]">
          提示：用 <span className="font-mono text-[var(--accent)]">@角色名</span> 引用角色库里的角色，生成时自动注入外观保持一致。
        </p>

        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={videoExtracting}
            onClick={() => videoInput.current?.click()}
            className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {videoExtracting ? (
              <FiLoader className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FiVideo className="h-3.5 w-3.5" />
            )}
            {videoExtracting ? "反推中…" : "上传参考视频 → 反推提示词"}
          </button>
          <button
            type="button"
            onClick={() => setShowCamera((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              showCamera ? "nav-item-active" : "btn-secondary"
            }`}
          >
            <FiMove className="h-3.5 w-3.5" />
            运镜轨迹
          </button>
          <input
            ref={videoInput}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleVideo(e.target.files?.[0])}
          />
        </div>
        {videoErr && (
          <p className="mb-2 text-xs font-medium text-[var(--danger)]">{videoErr}</p>
        )}

        {showCamera && (
          <div className="mb-3">
            <CameraTrajectoryPanel onApply={appendDirective} />
          </div>
        )}

        {mode === "builder" ? (
          <PromptBuilder
            onApply={(prompt) => onUpdatePrompt(activeShotIdx, prompt)}
          />
        ) : (
          <textarea
            className="input-field min-h-[120px] w-full rounded-lg px-3 py-2.5 text-sm leading-relaxed"
            value={prompts[activeShotIdx]?.providerPrompt ?? ""}
            onChange={(e) => onUpdatePrompt(activeShotIdx, e.target.value)}
          />
        )}

        {mode === "builder" && prompts[activeShotIdx]?.providerPrompt && (
          <div className="mt-3 rounded-lg border border-[var(--border)] p-3">
            <p className="mb-1 text-xs text-[var(--text-caption)]">当前镜头提示词</p>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              {prompts[activeShotIdx].providerPrompt}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
