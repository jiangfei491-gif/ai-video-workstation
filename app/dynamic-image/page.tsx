import AppShell from "@/app/components/layout/AppShell";
import OpenAIStatsBar from "@/app/components/layout/OpenAIStatsBar";
import T2I2VWorkbench from "@/app/components/workflows/t2i2v/T2I2VWorkbench";

export default function DynamicImagePage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <OpenAIStatsBar />
        <div className="min-h-0 flex-1 overflow-hidden">
          <T2I2VWorkbench />
        </div>
      </div>
    </AppShell>
  );
}
