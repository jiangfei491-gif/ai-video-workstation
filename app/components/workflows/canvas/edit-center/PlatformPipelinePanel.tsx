"use client";

import { useMemo } from "react";
import {
  AI_AGENT_CAPABILITIES,
  DIRECTOR_RESPONSIBILITIES,
  OPENCUT_CAPABILITIES,
  OPENCUT_ENGINE_RESPONSIBILITIES,
  OWNER_LABEL,
  PLATFORM_MODULES,
  PLATFORM_PIPELINE,
  type PipelineOwner,
} from "@/app/lib/platform";

const OWNER_STYLE: Record<PipelineOwner, string> = {
  director: "border-fuchsia-500/30 bg-fuchsia-500/8 text-fuchsia-600 dark:text-fuchsia-300",
  "clip-agent": "border-indigo-500/30 bg-indigo-500/8 text-indigo-600 dark:text-indigo-300",
  "ai-agent": "border-violet-500/30 bg-violet-500/8 text-violet-600 dark:text-violet-300",
  opencut: "border-sky-500/30 bg-sky-500/8 text-sky-600 dark:text-sky-300",
  ffmpeg: "border-amber-500/30 bg-amber-500/8 text-amber-700 dark:text-amber-300",
};

type Props = {
  compact?: boolean;
};

export default function PlatformPipelinePanel({ compact = false }: Props) {
  const grouped = useMemo(() => {
    const ai = PLATFORM_PIPELINE.filter((s) => s.owner === "ai-agent");
    const brain = PLATFORM_PIPELINE.filter(
      (s) => s.owner === "director" || s.owner === "clip-agent"
    );
    const cut = PLATFORM_PIPELINE.filter((s) => s.owner === "opencut");
    const tail = PLATFORM_PIPELINE.filter((s) => s.owner === "ffmpeg");
    return { ai, brain, cut, tail };
  }, []);

  if (compact) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5">
        <p className="text-[10px] font-semibold text-[var(--text-primary)]">各模块对照</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {PLATFORM_MODULES.map((m) => (
            <span
              key={m.id}
              className="rounded border border-[var(--border)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-secondary)]"
              title={`${m.overallLead} · ${m.aiLeadLabel} · ${m.engines}`}
            >
              {m.title}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[9px] leading-snug text-[var(--text-caption)]">
          AI 导演决策 → 剪辑 Agent 翻译命令 → OpenCut 执行
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-[var(--text-primary)]">各模块对照表</p>
        <p className="mt-0.5 text-[10px] text-[var(--text-caption)]">
          Director Plan → Clip Agent → OpenCut 命令；OpenCut 只执行，不思考。
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full min-w-[520px] text-left text-[10px]">
          <thead className="border-b border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-caption)]">
            <tr>
              <th className="px-2 py-1.5 font-medium">模块</th>
              <th className="px-2 py-1.5 font-medium">总负责人</th>
              <th className="px-2 py-1.5 font-medium">AI 负责人</th>
              <th className="px-2 py-1.5 font-medium">引擎</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {PLATFORM_MODULES.map((m) => (
              <tr key={m.id} className="text-[var(--text-secondary)]">
                <td className="px-2 py-1.5 font-medium text-[var(--text-primary)]">{m.title}</td>
                <td className="px-2 py-1.5">{m.overallLead}</td>
                <td className="px-2 py-1.5">{m.aiLeadLabel}</td>
                <td className="px-2 py-1.5 text-[var(--text-caption)]">{m.engines}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <p className="mb-1.5 text-[10px] font-medium text-violet-600 dark:text-violet-300">
          执行 Agent
        </p>
        <ul className="list-inside list-disc space-y-0.5 text-[10px] text-[var(--text-secondary)]">
          {AI_AGENT_CAPABILITIES.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-1">
          {grouped.ai.map((s) => (
            <span key={s.id} className={`rounded px-1.5 py-0.5 text-[9px] ${OWNER_STYLE[s.owner]}`}>
              {s.shortLabel}
            </span>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-1.5 text-[10px] font-medium text-fuchsia-600 dark:text-fuchsia-300">
          AI 导演 + 剪辑 Agent
        </p>
        <ul className="list-inside list-disc space-y-0.5 text-[10px] text-[var(--text-secondary)]">
          {DIRECTOR_RESPONSIBILITIES.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-1">
          {grouped.brain.map((s) => (
            <span key={s.id} className={`rounded px-1.5 py-0.5 text-[9px] ${OWNER_STYLE[s.owner]}`}>
              {s.shortLabel}
            </span>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-1.5 text-[10px] font-medium text-sky-600 dark:text-sky-300">
          OpenCut（剪辑 Agent 驱动）
        </p>
        <ul className="list-inside list-disc space-y-0.5 text-[10px] text-[var(--text-secondary)]">
          {OPENCUT_ENGINE_RESPONSIBILITIES.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] text-[var(--text-caption)]">
          {OPENCUT_CAPABILITIES.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-1">
          {grouped.cut.map((s) => (
            <span key={s.id} className={`rounded px-1.5 py-0.5 text-[9px] ${OWNER_STYLE[s.owner]}`}>
              {s.shortLabel}
            </span>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">流水线阶段</p>
        <div className="flex flex-wrap gap-1">
          {PLATFORM_PIPELINE.map((s) => (
            <span
              key={s.id}
              className={`rounded px-1.5 py-0.5 text-[9px] ${OWNER_STYLE[s.owner]}`}
              title={`${OWNER_LABEL[s.owner]} · ${s.description}`}
            >
              {s.shortLabel}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
