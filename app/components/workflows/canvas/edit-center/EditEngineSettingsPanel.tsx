"use client";

import Link from "next/link";
import type { EditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";
import { TRANSITION_ENGINE_OPTIONS } from "@/app/lib/auto-edit/engines/transition-engine/ffmpeg-xfade";
import type { TransitionType } from "@/app/lib/auto-edit/types";

type Props = {
  settings: EditEngineSettings;
  onChange: (patch: Partial<EditEngineSettings>) => void;
};

export default function EditEngineSettingsPanel({ settings, onChange }: Props) {
  const patchSubtitle = (p: Partial<EditEngineSettings["subtitle"]>) =>
    onChange({ subtitle: { ...settings.subtitle, ...p } });
  const patchMusic = (p: Partial<EditEngineSettings["music"]>) =>
    onChange({ music: { ...settings.music, ...p } });
  const patchTransition = (p: Partial<EditEngineSettings["transition"]>) =>
    onChange({ transition: { ...settings.transition, ...p } });
  const patchEffect = (p: Partial<EditEngineSettings["effect"]>) =>
    onChange({ effect: { ...settings.effect, ...p } });
  const patchAudio = (p: Partial<EditEngineSettings["audio"]>) =>
    onChange({ audio: { ...settings.audio, ...p } });
  const patchExport = (p: Partial<EditEngineSettings["export"]>) =>
    onChange({ export: { ...settings.export, ...p } });
  const patchLocalization = (p: Partial<EditEngineSettings["localization"]>) =>
    onChange({ localization: { ...settings.localization, ...p } });

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-primary)]">配音</p>
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-caption)]">
          引擎、音色与项目配音已迁移至侧边栏「配音中心」。
        </p>
        <Link
          href="/voice-center"
          className="btn-secondary mt-2 inline-flex rounded-lg px-2.5 py-1.5 text-[10px] font-medium"
        >
          打开配音中心
        </Link>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-primary)]">字幕</p>
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-caption)]">
          模板、动画、多语言与导出已迁移至侧边栏「字幕中心」。
        </p>
        <Link
          href="/subtitle-center"
          className="btn-secondary mt-2 inline-flex rounded-lg px-2.5 py-1.5 text-[10px] font-medium"
        >
          打开字幕中心
        </Link>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-primary)]">音乐引擎</p>
        <label className="mt-2 flex items-center gap-2 text-[10px]">
          <input
            type="checkbox"
            checked={settings.music.duckUnderVoice}
            onChange={(e) => patchMusic({ duckUnderVoice: e.target.checked })}
          />
          口播 Duck BGM（侧链压缩）
        </label>
        {settings.music.duckUnderVoice && (
          <label className="mt-2 block text-[10px] text-[var(--text-caption)]">
            Duck 强度 {Math.round(settings.music.duckAmount * 100)}%
            <input
              type="range"
              min={20}
              max={100}
              value={Math.round(settings.music.duckAmount * 100)}
              onChange={(e) => patchMusic({ duckAmount: Number(e.target.value) / 100 })}
              className="edit-range mt-1 w-full"
            />
          </label>
        )}
        <label className="mt-2 flex items-center gap-2 text-[10px]">
          <input
            type="checkbox"
            checked={settings.music.loop}
            onChange={(e) => patchMusic({ loop: e.target.checked })}
          />
          BGM 循环
        </label>
        <label className="mt-2 flex items-center gap-2 text-[10px]">
          <input
            type="checkbox"
            checked={settings.music.autoRecommend}
            onChange={(e) => patchMusic({ autoRecommend: e.target.checked })}
          />
          生成方案时自动推荐 BGM
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block text-[10px] text-[var(--text-caption)]">
            Fade In (秒)
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={settings.music.fadeInSec}
              onChange={(e) => patchMusic({ fadeInSec: Number(e.target.value) })}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
            />
          </label>
          <label className="block text-[10px] text-[var(--text-caption)]">
            Fade Out (秒)
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={settings.music.fadeOutSec}
              onChange={(e) => patchMusic({ fadeOutSec: Number(e.target.value) })}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-primary)]">转场引擎</p>
        <label className="mt-2 block text-[10px] text-[var(--text-caption)]">
          默认转场类型
          <select
            value={settings.transition.defaultType}
            onChange={(e) =>
              patchTransition({ defaultType: e.target.value as TransitionType })
            }
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
          >
            {TRANSITION_ENGINE_OPTIONS.filter((t) => t.implemented).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-2 block text-[10px] text-[var(--text-caption)]">
          默认转场时长 (ms)
          <input
            type="number"
            min={0}
            max={2000}
            value={settings.transition.defaultDurationMs}
            onChange={(e) => patchTransition({ defaultDurationMs: Number(e.target.value) })}
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
            disabled={settings.transition.defaultType === "cut"}
          />
        </label>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-primary)]">Effect / Audio</p>
        <label className="mt-2 flex items-center gap-2 text-[10px]">
          <input
            type="checkbox"
            checked={settings.effect.enabled}
            onChange={(e) => patchEffect({ enabled: e.target.checked })}
          />
          启用画面特效
        </label>
        {settings.effect.enabled && (
          <div className="mt-2 space-y-1 pl-4 text-[10px]">
            {(["sharpen", "filmGrain", "vignette"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.effect[k]}
                  onChange={(e) => patchEffect({ [k]: e.target.checked })}
                />
                {k === "sharpen" ? "锐化" : k === "filmGrain" ? "胶片颗粒" : "暗角"}
              </label>
            ))}
          </div>
        )}
        <div className="mt-2 space-y-1 text-[10px]">
          {(["denoise", "loudnorm", "compress"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.audio[k]}
                onChange={(e) => patchAudio({ [k]: e.target.checked })}
              />
              {k === "denoise" ? "降噪" : k === "loudnorm" ? "响度归一" : "压缩"}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-primary)]">字幕关键词</p>
        <label className="mt-2 block text-[10px] text-[var(--text-caption)]">
          高亮词（逗号分隔）
          <input
            value={(settings.subtitle.highlightKeywords ?? []).join("，")}
            onChange={(e) =>
              patchSubtitle({
                highlightKeywords: e.target.value
                  .split(/[,，]/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
            placeholder="品牌名, 产品名"
          />
        </label>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-primary)]">多语言 (Localization)</p>
        <label className="mt-2 flex items-center gap-2 text-[10px]">
          <input
            type="checkbox"
            checked={settings.localization.enabled}
            onChange={(e) => patchLocalization({ enabled: e.target.checked })}
          />
          导出时生成多语言字幕
        </label>
        <label className="mt-2 flex items-center gap-2 text-[10px]">
          <input
            type="checkbox"
            checked={settings.localization.translateSubtitles}
            onChange={(e) => patchLocalization({ translateSubtitles: e.target.checked })}
            disabled={!settings.localization.enabled}
          />
          GPT 翻译字幕
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(["en", "ja", "ko", "vi"] as const).map((lang) => (
            <label key={lang} className="flex items-center gap-1 text-[9px]">
              <input
                type="checkbox"
                checked={settings.localization.targetLanguages.includes(lang)}
                disabled={!settings.localization.enabled}
                onChange={(e) => {
                  const cur = settings.localization.targetLanguages;
                  patchLocalization({
                    targetLanguages: e.target.checked
                      ? [...cur, lang]
                      : cur.filter((l) => l !== lang),
                  });
                }}
              />
              {lang.toUpperCase()}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-primary)]">导出</p>
        <label className="mt-2 flex items-center gap-2 text-[10px]">
          <input
            type="checkbox"
            checked={settings.export.prores}
            onChange={(e) => patchExport({ prores: e.target.checked, format: e.target.checked ? "mov" : "mp4" })}
          />
          ProRes / MOV 成片（实验）
        </label>
        <label className="mt-2 flex items-center gap-2 text-[10px]">
          <input
            type="checkbox"
            checked={settings.export.includeSrt}
            onChange={(e) => patchExport({ includeSrt: e.target.checked })}
          />
          附带 SRT
        </label>
        <label className="mt-2 flex items-center gap-2 text-[10px]">
          <input
            type="checkbox"
            checked={settings.export.includeAss}
            onChange={(e) => patchExport({ includeAss: e.target.checked })}
          />
          附带 ASS
        </label>
      </section>
    </div>
  );
}
