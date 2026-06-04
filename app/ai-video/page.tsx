import AppShell from "@/app/components/layout/AppShell";
import OpenAIStatsBar from "@/app/components/layout/OpenAIStatsBar";
import T2VWorkbench from "@/app/components/workflows/t2v/T2VWorkbench";

export default function AiVideoPage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <OpenAIStatsBar />
        <div className="min-h-0 flex-1 overflow-hidden">
          <T2VWorkbench />
        </div>
      </div>
    </AppShell>
  );
}
