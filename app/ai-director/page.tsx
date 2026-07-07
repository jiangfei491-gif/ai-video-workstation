import AppShell from "@/app/components/layout/AppShell";
import AiDirectorShell from "@/app/components/ai-director/AiDirectorShell";

export default function AiDirectorPage() {
  return (
    <AppShell>
      <div className="h-full min-h-0 overflow-hidden">
        <AiDirectorShell />
      </div>
    </AppShell>
  );
}
