"use client";

import { useState } from "react";
import ProjectCharactersPanel from "./ProjectCharactersPanel";
import ProjectScenesPanel from "./ProjectScenesPanel";
import ProjectPropsPanel from "./ProjectPropsPanel";

type Tab = "characters" | "scenes" | "props";

type Props = {
  characterIds: string[];
  sceneIds: string[];
  propIds: string[];
  onCharacterIdsChange: (ids: string[]) => void;
  onSceneIdsChange: (ids: string[]) => void;
  onPropIdsChange: (ids: string[]) => void;
};

export default function ProjectResourcesPanel({
  characterIds,
  sceneIds,
  propIds,
  onCharacterIdsChange,
  onSceneIdsChange,
  onPropIdsChange,
}: Props) {
  const [tab, setTab] = useState<Tab>("characters");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-1">
        {(
          [
            ["characters", "角色"],
            ["scenes", "场景"],
            ["props", "道具"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === id
                ? "bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {label}
            <span className="ml-1 text-xs text-[var(--text-caption)]">
              ({id === "characters" ? characterIds.length : id === "scenes" ? sceneIds.length : propIds.length})
            </span>
          </button>
        ))}
      </div>
      {tab === "characters" && (
        <ProjectCharactersPanel characterIds={characterIds} onChange={onCharacterIdsChange} />
      )}
      {tab === "scenes" && (
        <ProjectScenesPanel sceneIds={sceneIds} onChange={onSceneIdsChange} />
      )}
      {tab === "props" && (
        <ProjectPropsPanel propIds={propIds} onChange={onPropIdsChange} />
      )}
    </div>
  );
}
