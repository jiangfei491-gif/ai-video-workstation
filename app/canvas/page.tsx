import AppShell from "@/app/components/layout/AppShell";
import CanvasEditShell from "@/app/components/workflows/canvas/CanvasEditShell";

export default function CanvasPage() {
  return (
    <AppShell>
      <div className="h-full min-h-0 overflow-hidden">
        <CanvasEditShell />
      </div>
    </AppShell>
  );
}
