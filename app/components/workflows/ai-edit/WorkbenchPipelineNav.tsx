"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiEdit3, FiFilm } from "react-icons/fi";

const STEPS = [
  { href: "/ai-edit", label: "AI剪辑", icon: FiFilm, exact: true },
  { href: "/ai-edit/advanced", label: "高级剪辑", icon: FiEdit3 },
] as const;

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function WorkbenchPipelineNav() {
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 flex-wrap items-center gap-1 border-b border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2">
      {STEPS.map((step) => {
        const Icon = step.icon;
        const active = isActive(pathname, step.href, "exact" in step ? step.exact : false);
        return (
          <Link
            key={step.href}
            href={step.href}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              active
                ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                : "text-[var(--text-caption)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {step.label}
          </Link>
        );
      })}
    </nav>
  );
}
