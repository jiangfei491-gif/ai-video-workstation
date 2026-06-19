import AppShell from "@/app/components/layout/AppShell";
import CharacterLibraryPanel from "@/app/components/workflows/t2v/CharacterLibraryPanel";

export default function CharactersPage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h1 className="workbench-page-title">角色库</h1>
          <p className="workbench-page-desc mt-1">
            统一管理角色 · 视频创作的分镜提示词里用 @角色名 引用，生成时自动注入外观，保证跨镜头人物一致
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <CharacterLibraryPanel />
        </div>
      </div>
    </AppShell>
  );
}
