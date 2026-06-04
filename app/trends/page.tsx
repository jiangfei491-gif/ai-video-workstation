import AppShell from "@/app/components/layout/AppShell";
import OpenAIStatsBar from "@/app/components/layout/OpenAIStatsBar";
import TrendsHubPage from "@/app/components/trends/TrendsHubPage";

export default function TrendsPage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <OpenAIStatsBar />
        <div className="min-h-0 flex-1 overflow-hidden">
          <TrendsHubPage />
        </div>
      </div>
    </AppShell>
  );
}
