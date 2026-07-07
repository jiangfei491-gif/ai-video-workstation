import AppShell from "@/app/components/layout/AppShell";
import SubtitleCenterShell from "@/app/components/subtitle-center/SubtitleCenterShell";
import ModuleLeadStrip from "@/app/components/platform/ModuleLeadStrip";

export default function SubtitleCenterPage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h1 className="workbench-page-title">字幕中心</h1>
          <p className="workbench-page-desc mt-1">
            统一字幕平台 · DeepSeek 智能优化 · Rule Engine 导出 · 交付 OpenCut
          </p>
          <ModuleLeadStrip moduleId="subtitle-center" showResponsibilities />
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SubtitleCenterShell />
        </div>
      </div>
    </AppShell>
  );
}
