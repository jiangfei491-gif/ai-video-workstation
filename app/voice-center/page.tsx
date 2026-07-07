import AppShell from "@/app/components/layout/AppShell";
import VoiceCenterShell from "@/app/components/voice-center/VoiceCenterShell";
import ModuleLeadStrip from "@/app/components/platform/ModuleLeadStrip";

export default function VoiceCenterPage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h1 className="workbench-page-title">配音中心</h1>
          <p className="workbench-page-desc mt-1">
            统一语音引擎 · 接收导演任务 · 选引擎 · 合成 · 返回音频与时间轴
          </p>
          <ModuleLeadStrip moduleId="voice-center" showResponsibilities />
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <VoiceCenterShell />
        </div>
      </div>
    </AppShell>
  );
}
