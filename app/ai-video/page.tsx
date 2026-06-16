import AppShell from "@/app/components/layout/AppShell";
import T2VWorkbench from "@/app/components/workflows/t2v/T2VWorkbench";

export default function AiVideoPage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <T2VWorkbench />
      </div>
    </AppShell>
  );
}
