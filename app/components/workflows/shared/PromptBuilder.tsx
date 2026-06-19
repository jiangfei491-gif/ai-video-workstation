"use client";

import { useRef, useState } from "react";
import { FiImage, FiZap, FiCheck, FiLoader } from "react-icons/fi";
import {
  EMPTY_BLUEPRINT,
  SHOT_PRESETS,
  LIGHTING_PRESETS,
  STYLE_PRESETS,
  assembleBlueprint,
  isBlueprintEmpty,
  type PromptBlueprint,
  type PresetChip,
} from "@/app/lib/director/prompt-blueprint";
import { fileToScaledDataUrl } from "@/app/lib/image-client";

type Props = {
  /** 应用拼装好的提示词到当前镜头 */
  onApply: (prompt: string) => void;
};

function ChipRow({
  presets,
  value,
  onPick,
}: {
  presets: PresetChip[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((c) => {
        const active = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onPick(active ? "" : c.value)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              active ? "nav-item-active" : "btn-secondary"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export default function PromptBuilder({ onApply }: Props) {
  const [bp, setBp] = useState<PromptBlueprint>(EMPTY_BLUEPRINT);
  const [thumb, setThumb] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = (k: keyof PromptBlueprint, v: string) =>
    setBp((prev) => ({ ...prev, [k]: v }));

  const preview = assembleBlueprint(bp);

  async function handleFile(file: File | undefined | null) {
    if (!file || !file.type.startsWith("image/")) return;
    setErr(null);
    setExtracting(true);
    try {
      const dataUrl = await fileToScaledDataUrl(file);
      setThumb(dataUrl);
      const res = await fetch("/api/director/extract-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "反推失败");
      setBp(data.blueprint as PromptBlueprint);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setExtracting(false);
    }
  }

  function apply() {
    if (!preview) return;
    onApply(preview);
    setApplied(true);
    setTimeout(() => setApplied(false), 1500);
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]/40 p-4">
      {/* 参考图反推入口 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => fileInput.current?.click()}
        className={`mb-4 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors ${
          dragOver
            ? "border-[var(--accent)] bg-[var(--accent)]/10"
            : "border-[var(--border)] hover:border-[var(--accent)]/60"
        }`}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="参考图" className="h-12 w-12 rounded object-cover" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded bg-[var(--bg-surface)] text-[var(--text-secondary)]">
            {extracting ? (
              <FiLoader className="h-5 w-5 animate-spin" />
            ) : (
              <FiImage className="h-5 w-5" />
            )}
          </span>
        )}
        <div className="min-w-0">
          <p className="font-medium text-[var(--text-primary)]">
            {extracting ? "正在反推提示词…" : "拖入参考图，自动反推填空"}
          </p>
          <p className="text-xs text-[var(--text-caption)]">
            从「想要这种感觉」直接起步 · 点击或拖拽上传
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {/* 填空槽位 */}
      <div className="space-y-3">
        <Field label="🎬 景别">
          <ChipRow presets={SHOT_PRESETS} value={bp.shot} onPick={(v) => set("shot", v)} />
        </Field>

        <Field label="🎭 主体">
          <input
            className="input-field w-full rounded-lg px-3 py-2 text-sm"
            value={bp.subject}
            onChange={(e) => set("subject", e.target.value)}
            placeholder="谁 / 什么（如 a young woman in a red coat）"
          />
        </Field>

        <Field label="🏃 动作">
          <input
            className="input-field w-full rounded-lg px-3 py-2 text-sm"
            value={bp.action}
            onChange={(e) => set("action", e.target.value)}
            placeholder="在做什么（如 walking slowly toward camera）"
          />
        </Field>

        <Field label="🌆 场景 / 环境">
          <input
            className="input-field w-full rounded-lg px-3 py-2 text-sm"
            value={bp.scene}
            onChange={(e) => set("scene", e.target.value)}
            placeholder="地点 / 背景 / 时间（如 a rainy neon-lit street at night）"
          />
        </Field>

        <Field label="💡 光线 / 氛围">
          <ChipRow
            presets={LIGHTING_PRESETS}
            value={bp.lighting}
            onPick={(v) => set("lighting", v)}
          />
        </Field>

        <Field label="🎨 风格">
          <ChipRow presets={STYLE_PRESETS} value={bp.style} onPick={(v) => set("style", v)} />
        </Field>
      </div>

      {/* 实时拼装预览 */}
      <div className="mt-4 rounded-lg bg-[var(--bg-surface)] p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-[var(--text-caption)]">
          <FiZap className="h-3.5 w-3.5" />
          实时拼装的提示词
        </div>
        <p className="min-h-[2.5rem] text-sm leading-relaxed text-[var(--text-secondary)]">
          {preview || <span className="text-[var(--text-caption)]">填入上面的字段，这里会自动拼出专业英文提示词…</span>}
        </p>
      </div>

      {err && <p className="mt-2 text-xs font-medium text-[var(--danger)]">{err}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!preview}
          onClick={apply}
          className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {applied ? <FiCheck className="h-4 w-4" /> : <FiZap className="h-4 w-4" />}
          {applied ? "已应用到镜头" : "应用到当前镜头"}
        </button>
        {!isBlueprintEmpty(bp) && (
          <button
            type="button"
            onClick={() => {
              setBp(EMPTY_BLUEPRINT);
              setThumb(null);
              setErr(null);
            }}
            className="btn-secondary rounded-lg px-3 py-2 text-sm"
          >
            清空
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="workbench-label mb-1.5 block text-xs">{label}</label>
      {children}
    </div>
  );
}
