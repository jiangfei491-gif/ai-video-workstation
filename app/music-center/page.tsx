import AppShell from "@/app/components/layout/AppShell";
import MusicCenterShell from "@/app/components/music-center/MusicCenterShell";
import ModuleLeadStrip from "@/app/components/platform/ModuleLeadStrip";

export default function MusicCenterPage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h1 className="workbench-page-title">音乐中心</h1>
          <p className="workbench-page-desc mt-1">
            DeepSeek 推荐 BGM · Rule Engine 时间轴 · Ducking · 卡点 · 交付 OpenCut
          </p>
          <ModuleLeadStrip moduleId="music-center" showResponsibilities />
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <MusicCenterShell />
        </div>
      </div>
    </AppShell>
  );
}
