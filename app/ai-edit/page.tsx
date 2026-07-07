import AppShell from "@/app/components/layout/AppShell";
import AiAutoEditShell from "@/app/components/workflows/ai-edit/AiAutoEditShell";

export default function AiEditPage() {
  return (
    <AppShell>
      <div className="h-full min-h-0 overflow-hidden">
        <AiAutoEditShell />
      </div>
    </AppShell>
  );
}
