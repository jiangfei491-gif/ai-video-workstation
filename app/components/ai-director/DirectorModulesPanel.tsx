"use client";

import Link from "next/link";
import { useMemo } from "react";
import { FiExternalLink, FiRefreshCw } from "react-icons/fi";
import { moduleRerunDisabledReason } from "@/app/lib/ai-director/module-rerun";
import {
  DIRECTOR_MODULE_ROLE,
  DIRECTOR_MODULE_ROLE_LABEL,
  DIRECTOR_RESPONSIBILITIES,
  getDirectorAdjacentModules,
  getDirectorManagedModules,
  getModuleHref,
} from "@/app/lib/platform";
import type { ModuleId } from "@/app/lib/platform";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";

type ModuleStatus = {
  label: string;
  tone: "ok" | "pending" | "muted";
};

function moduleStatus(moduleId: ModuleId, state: T2VWorkbenchState): ModuleStatus {
  const t = state.editGraph?.timeline;
  switch (moduleId) {
    case "ai-director":
      return state.directorPlan?.clips?.length
        ? { label: `Plan ${state.directorPlan.clips.length} 镜`, tone: "ok" }
        : { label: "待生成 Plan", tone: "pending" };
    case "material-center":
      return state.sourceScript?.trim()
        ? { label: "已导入脚本", tone: "ok" }
        : { label: "可选", tone: "muted" };
    case "video-creation-script":
      return state.director?.storyboard?.length
        ? { label: `${state.director.storyboard.length} 镜分镜`, tone: "ok" }
        : { label: "待编导", tone: "pending" };
    case "video-creation-media": {
      const n = Object.values(state.batchResults ?? {}).filter((r) => r?.status === "success").length;
      const frames = Object.keys(state.shotFrames ?? {}).length;
      const count = Math.max(n, frames);
      return count > 0
        ? { label: `${count} 镜画面`, tone: "ok" }
        : { label: "待生成画面", tone: "pending" };
    }
    case "voice-center":
      return (t?.voice.length ?? 0) > 0
        ? { label: `${t!.voice.length} 条配音`, tone: "ok" }
        : { label: "待配音", tone: "pending" };
    case "subtitle-center":
      return (t?.subtitle.length ?? 0) > 0
        ? { label: `${t!.subtitle.length} 条字幕`, tone: "ok" }
        : { label: "待字幕", tone: "pending" };
    case "music-center":
      return (t?.music.length ?? 0) > 0
        ? { label: `${t!.music.length} 轨 BGM`, tone: "ok" }
        : { label: "待音乐", tone: "pending" };
    case "effect-center":
      return (t?.transitions.length ?? 0) > 0
        ? { label: `${t!.transitions.length} 转场`, tone: "ok" }
        : { label: "待特效", tone: "pending" };
    default:
      return { label: "—", tone: "muted" };
  }
}

function statusClass(tone: ModuleStatus["tone"]): string {
  if (tone === "ok") return "bg-[var(--success)]/10 text-[var(--success)]";
  if (tone === "pending") return "bg-amber-500/10 text-amber-600 dark:text-amber-300";
  return "bg-[var(--bg-inset)] text-[var(--text-caption)]";
}

function roleClass(role: keyof typeof DIRECTOR_MODULE_ROLE_LABEL): string {
  if (role === "decision") return "border-fuchsia-500/30 text-fuchsia-600 dark:text-fuchsia-300";
  if (role === "orchestrate") return "border-violet-500/30 text-violet-600 dark:text-violet-300";
  return "border-[var(--border)] text-[var(--text-caption)]";
}

type Props = {
  workbench: T2VWorkbenchState;
  running?: boolean;
  onRerun?: (moduleId: ModuleId) => void;
};

export default function DirectorModulesPanel({ workbench, running, onRerun }: Props) {
  const managed = useMemo(() => getDirectorManagedModules(), []);
  const adjacent = useMemo(() => getDirectorAdjacentModules(), []);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">导演管辖模块</h2>
          <p className="mt-1 text-[10px] text-[var(--text-caption)]">
            总负责人：AI 导演 GPT-4.1 · 下列模块由导演决策或编排，执行 AI 见各模块说明
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {DIRECTOR_RESPONSIBILITIES.map((item) => (
            <span
              key={item}
              className="rounded-full border border-fuchsia-500/25 bg-fuchsia-500/5 px-2 py-0.5 text-[10px] text-fuchsia-700 dark:text-fuchsia-200"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {managed.map((mod) => {
          const href = getModuleHref(mod.id);
          const role = DIRECTOR_MODULE_ROLE[mod.id] ?? "orchestrate";
          const status = moduleStatus(mod.id, workbench);
          return (
            <div
              key={mod.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)]/50 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{mod.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[9px] ${roleClass(role)}`}
                    >
                      {DIRECTOR_MODULE_ROLE_LABEL[role]}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] ${statusClass(status.tone)}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {onRerun && (
                    <button
                      type="button"
                      onClick={() => onRerun(mod.id)}
                      disabled={Boolean(running || moduleRerunDisabledReason(mod.id, workbench))}
                      title={
                        moduleRerunDisabledReason(mod.id, workbench) ?? `重跑${mod.title}`
                      }
                      className="inline-flex items-center gap-0.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <FiRefreshCw className="h-3 w-3" />
                      重跑
                    </button>
                  )}
                  {href && mod.id !== "ai-director" && (
                    <Link
                      href={href}
                      className="text-[var(--accent)] hover:opacity-80"
                      title={`打开${mod.title}`}
                    >
                      <FiExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[10px] leading-snug text-[var(--text-caption)]">
                AI：{mod.aiLeadLabel}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-[var(--text-secondary)]">
                {mod.responsibilities}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-[var(--border)] pt-3">
        <p className="text-[10px] font-medium text-[var(--text-caption)]">
          非导演总负责（执行 / 验收）
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {adjacent.map((mod) => {
            const href = getModuleHref(mod.id);
            return (
              <Link
                key={mod.id}
                href={href ?? "#"}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {mod.title}
                <span className="text-[var(--text-caption)]">· {mod.aiLeadLabel}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
