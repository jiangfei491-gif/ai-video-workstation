import { getPlatformModule, type ModuleId } from "@/app/lib/platform";

type Props = {
  moduleId: ModuleId;
  /** 是否显示职责摘要 */
  showResponsibilities?: boolean;
};

export default function ModuleLeadStrip({
  moduleId,
  showResponsibilities = false,
}: Props) {
  const mod = getPlatformModule(moduleId);
  if (!mod) return null;

  return (
    <div className="mt-2 space-y-1 text-xs text-[var(--text-caption)]">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          总负责人：
          <span className="font-medium text-[var(--text-secondary)]">{mod.overallLead}</span>
        </span>
        <span>
          AI 负责人：
          <span className="font-medium text-[var(--text-secondary)]">{mod.aiLeadLabel}</span>
        </span>
        <span>
          引擎：
          <span className="text-[var(--text-secondary)]">{mod.engines}</span>
        </span>
      </div>
      {showResponsibilities && (
        <p className="text-[var(--text-caption)]">{mod.responsibilities}</p>
      )}
    </div>
  );
}
