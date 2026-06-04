"use client";

import { useState } from "react";
import TikTokTrendsPage from "@/app/components/tiktok/TikTokTrendsPage";
import YouTubeTrendsPage from "@/app/components/youtube/YouTubeTrendsPage";

type Tab = "tiktok" | "youtube";

export default function TrendsHubPage() {
  const [tab, setTab] = useState<Tab>("tiktok");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold">热点中心</h1>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("tiktok")}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === "tiktok"
                ? "nav-item-active font-medium"
                : "text-[var(--text-muted)]"
            }`}
          >
            TikTok Trends
          </button>
          <button
            type="button"
            onClick={() => setTab("youtube")}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === "youtube"
                ? "nav-item-active font-medium"
                : "text-[var(--text-muted)]"
            }`}
          >
            YouTube Trends
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "tiktok" ? <TikTokTrendsPage /> : <YouTubeTrendsPage />}
      </div>
    </div>
  );
}
