import AppShell from "@/app/components/layout/AppShell";
import IntelligenceCenterShell from "@/app/components/intelligence-center/IntelligenceCenterShell";

export default function IntelligenceCenterPage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h1 className="workbench-page-title">AI 情报中心</h1>
          <p className="workbench-page-desc mt-1">
            AI Video OS 技术升级中心 · 发现 / 分析 / 推荐 / 升级 所有 AI 新技术
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <IntelligenceCenterShell />
        </div>
      </div>
    </AppShell>
  );
}
