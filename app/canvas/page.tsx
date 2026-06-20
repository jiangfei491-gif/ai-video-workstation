import AppShell from "@/app/components/layout/AppShell";
import ProjectCanvas from "@/app/components/workflows/canvas/ProjectCanvas";

export default function CanvasPage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h1 className="workbench-page-title">项目画布</h1>
          <p className="workbench-page-desc mt-1">
            把全片分镜与角色铺在一张无限画布上纵览连续性 · 从角色拉线到分镜即可「选角」，自动注入 @角色名
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ProjectCanvas />
        </div>
      </div>
    </AppShell>
  );
}
