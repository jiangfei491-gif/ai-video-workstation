"use client";

import {
  FiCpu,
  FiFileText,
  FiFilm,
  FiGrid,
  FiMic,
  FiType,
} from "react-icons/fi";
import type { ReactNode } from "react";

export type EditLibraryTab = "media" | "audio" | "subtitle" | "ai" | "script" | "storyboard";

const TABS: { id: EditLibraryTab; label: string; icon: typeof FiGrid }[] = [
  { id: "media", label: "素材", icon: FiGrid },
  { id: "audio", label: "音频", icon: FiMic },
  { id: "subtitle", label: "字幕", icon: FiType },
  { id: "ai", label: "导演", icon: FiCpu },
  { id: "script", label: "脚本", icon: FiFileText },
  { id: "storyboard", label: "分镜", icon: FiFilm },
];

type Props = {
  tab: EditLibraryTab;
  onTab: (tab: EditLibraryTab) => void;
  showScript?: boolean;
  showStoryboard?: boolean;
  children: ReactNode;
};

export default function EditLibraryPanel({
  tab,
  onTab,
  showScript = true,
  showStoryboard = true,
  children,
}: Props) {
  const visible = TABS.filter((t) => {
    if (t.id === "script" && !showScript) return false;
    if (t.id === "storyboard" && !showStoryboard) return false;
    return true;
  });

  return (
    <aside className="nle-library flex h-full min-h-0 w-[min(100%,260px)] shrink-0 border-r border-[var(--border-strong)] bg-[var(--bg-surface)] lg:w-[280px]">
      <nav className="nle-library-rail flex w-11 shrink-0 flex-col items-center gap-0.5 border-r border-[var(--border)] bg-[var(--bg-inset)] py-2">
        {visible.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              title={t.label}
              onClick={() => onTab(t.id)}
              className={`flex w-9 flex-col items-center gap-0.5 rounded-md py-1.5 text-[9px] ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-caption)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </nav>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
    </aside>
  );
}
