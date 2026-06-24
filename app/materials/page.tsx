import AppShell from "@/app/components/layout/AppShell";
import MaterialCenter from "@/app/components/materials/MaterialCenter";

export default function MaterialsPage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h1 className="workbench-page-title">素材中心</h1>
          <p className="workbench-page-desc mt-1">
            互联网素材 → AI 分析 → 生成脚本 → 视频：整条内容流水线的源头
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <MaterialCenter />
        </div>
      </div>
    </AppShell>
  );
}
