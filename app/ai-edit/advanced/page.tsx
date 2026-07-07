import AppShell from "@/app/components/layout/AppShell";
import EditAdvancedShell from "@/app/components/workflows/ai-edit/EditAdvancedShell";

export default function AiEditAdvancedPage() {
  return (
    <AppShell>
      <div className="h-full min-h-0 overflow-hidden">
        <EditAdvancedShell />
      </div>
    </AppShell>
  );
}
