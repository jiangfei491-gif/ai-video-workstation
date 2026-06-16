import AppShell from "@/app/components/layout/AppShell";
import T2IWorkbench from "@/app/components/workflows/t2i/T2IWorkbench";

export default function DynamicImagePage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <T2IWorkbench />
      </div>
    </AppShell>
  );
}
