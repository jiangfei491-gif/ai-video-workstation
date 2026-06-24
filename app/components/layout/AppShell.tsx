"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiClock,
  FiFilm,
  FiGrid,
  FiInbox,
  FiMoon,
  FiSun,
  FiTrendingUp,
  FiUsers,
  FiVideo,
} from "react-icons/fi";
import {
  APP_NAV_ITEMS,
  resolveActiveNavId,
  type AppNavId,
} from "@/app/lib/nav-config";
import { useTheme } from "@/app/lib/theme/store";
import { patchUiState } from "@/app/lib/ui-state/store";

const NAV_ICONS: Record<AppNavId, React.ComponentType<{ className?: string }>> = {
  "ai-video": FiVideo,
  canvas: FiGrid,
  materials: FiInbox,
  characters: FiUsers,
  "dynamic-image": FiFilm,
  history: FiClock,
  trends: FiTrendingUp,
};

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const activeId = resolveActiveNavId(pathname);

  function onNavClick(id: AppNavId) {
    patchUiState({ currentMenu: id });
  }

  return (
    <div className="workspace-shell flex h-screen overflow-hidden">
      <aside className="glass-sidebar z-20 flex w-52 shrink-0 flex-col border-r border-[var(--border)]">
        <div className="border-b border-[var(--border)] px-4 py-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">AI 工作台</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          {APP_NAV_ITEMS.map((item) => {
            const Icon = NAV_ICONS[item.id];
            const active = activeId === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => onNavClick(item.id)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "nav-item-active font-semibold"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] p-3">
          <button
            type="button"
            onClick={toggle}
            className="theme-toggle flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          >
            {theme === "dark" ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
            {theme === "dark" ? "浅色模式" : "深色模式"}
          </button>
        </div>
      </aside>
      <div className="relative min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
