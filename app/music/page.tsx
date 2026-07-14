import AppShell from "@/app/components/layout/AppShell";
import MusicModuleShell from "@/app/components/music-module/MusicModuleShell";

export default function MusicModulePage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h1 className="workbench-page-title">音乐</h1>
          <p className="workbench-page-desc mt-1">
            公版歌词（粘贴导入入库）· 原创歌词（GPT 提示词创作）
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <MusicModuleShell />
        </div>
      </div>
    </AppShell>
  );
}
