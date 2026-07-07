import AppShell from "@/app/components/layout/AppShell";
import QaCenterShell from "@/app/components/qa-center/QaCenterShell";
import ModuleLeadStrip from "@/app/components/platform/ModuleLeadStrip";

export default function QaCenterPage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h1 className="workbench-page-title">质检中心</h1>
          <p className="workbench-page-desc mt-1">
            Rule Engine + FFmpeg 探测 + DeepSeek 评分 · 环节定点回流，需您拍板后自动修复
          </p>
          <ModuleLeadStrip moduleId="qa-center" showResponsibilities />
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <QaCenterShell />
        </div>
      </div>
    </AppShell>
  );
}
