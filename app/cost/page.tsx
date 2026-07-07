import AppShell from "@/app/components/layout/AppShell";
import CostCenterShell from "@/app/components/cost/CostCenterShell";

export default function CostPage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h1 className="workbench-page-title">成本中心</h1>
          <p className="workbench-page-desc mt-1">全平台 API 花费总账 · 按模块 / 模型 / 供应商 / 时间统计</p>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <CostCenterShell />
        </div>
      </div>
    </AppShell>
  );
}
