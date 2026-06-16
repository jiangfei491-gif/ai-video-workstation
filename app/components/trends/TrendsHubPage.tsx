"use client";

import { useState } from "react";
import TikTokTrendsPage from "@/app/components/tiktok/TikTokTrendsPage";
import YouTubeTrendsPage from "@/app/components/youtube/YouTubeTrendsPage";

type Tab = "tiktok" | "youtube";
const TAB_KEY = "workbench:trends-tab";

function readTab(): Tab {
  if (typeof window === "undefined") return "tiktok";
  try {
    return localStorage.getItem(TAB_KEY) === "youtube" ? "youtube" : "tiktok";
  } catch {
    return "tiktok";
  }
}

export default function TrendsHubPage() {
  const [tab, setTab] = useState<Tab>(() => readTab());

  function switchTab(next: Tab) {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <h1 className="workbench-page-title">热点中心</h1>
        <div className="flex gap-1 rounded-lg bg-[var(--bg-inset)] p-0.5">
          <button
            type="button"
            onClick={() => switchTab("tiktok")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === "tiktok"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)]"
            }`}
          >
            TikTok 热榜
          </button>
          <button
            type="button"
            onClick={() => switchTab("youtube")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === "youtube"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)]"
            }`}
          >
            YouTube 热榜
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "tiktok" ? <TikTokTrendsPage /> : <YouTubeTrendsPage />}
      </div>
    </div>
  );
}
