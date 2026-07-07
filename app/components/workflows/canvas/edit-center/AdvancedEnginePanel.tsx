"use client";

import EditEngineSettingsPanel from "./EditEngineSettingsPanel";
import StoryGraphPanel from "./StoryGraphPanel";
import ExportPanel from "./ExportPanel";
import EngineRoadmapPanel from "./EngineRoadmapPanel";
import type { T2VWorkbenchState } from "@/app/lib/workbench-persist/types";
import type { EditEngineSettings } from "@/app/lib/auto-edit/engines/edit-settings";

type Props = {
  state: T2VWorkbenchState;
  settings: EditEngineSettings;
  projectName: string;
  onSettingsChange: (patch: Partial<EditEngineSettings>) => void;
};

export default function AdvancedEnginePanel({
  state,
  settings,
  projectName,
  onSettingsChange,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3">
      <p className="text-xs font-semibold text-[var(--text-primary)]">Render Engine 高级</p>
      <p className="mt-0.5 text-[10px] text-[var(--text-caption)]">
        引擎配置 · Story Graph · 导出
      </p>
      <div className="mt-3">
        <EditEngineSettingsPanel settings={settings} onChange={onSettingsChange} />
      </div>
      <div className="mt-3">
        <StoryGraphPanel
          state={state}
          engineSettings={settings}
          onBpmChange={(bpm) => onSettingsChange({ storyGraph: { bpm } })}
          onApplyBeatSync={() => {}}
        />
      </div>
      <div className="mt-3">
        <ExportPanel state={state} settings={settings} projectName={projectName} />
      </div>
      <EngineRoadmapPanel />
    </div>
  );
}
