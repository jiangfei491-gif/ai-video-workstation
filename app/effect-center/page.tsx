import AppShell from "@/app/components/layout/AppShell";
import EffectCenterShell from "@/app/components/effect-center/EffectCenterShell";
import ModuleLeadStrip from "@/app/components/platform/ModuleLeadStrip";

export default function EffectCenterPage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h1 className="workbench-page-title">特效中心</h1>
          <p className="workbench-page-desc mt-1">
            DeepSeek 分析镜头节奏 · Rule Engine 生成转场/特效时间轴 · 交付 OpenCut
          </p>
          <ModuleLeadStrip moduleId="effect-center" showResponsibilities />
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <EffectCenterShell />
        </div>
      </div>
    </AppShell>
  );
}
