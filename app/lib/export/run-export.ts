import type { ExportMeta, ExportType } from "./types";
import { createDefaultExportMeta } from "./types";

export async function runWorkbenchExport(opts: {
  exportType: ExportType;
  fileName: string;
  getExport: () => ExportMeta;
  patchExport: (meta: ExportMeta) => void;
  execute: (
    onProgress: (pct: number, stageMessage?: string) => void
  ) => Promise<void>;
}): Promise<ExportMeta> {
  const base = opts.getExport();
  opts.patchExport({
    ...base,
    exportStatus: "exporting",
    exportProgress: 0,
    exportError: null,
    exportStageMessage: "准备导出…",
    activeExportType: opts.exportType,
    exportFileName: opts.fileName,
  });

  const tick = (pct: number, stageMessage?: string) => {
    opts.patchExport({
      ...opts.getExport(),
      exportStatus: "exporting",
      exportProgress: Math.min(99, Math.max(0, Math.round(pct))),
      exportError: null,
      exportStageMessage: stageMessage ?? opts.getExport().exportStageMessage,
      activeExportType: opts.exportType,
      exportFileName: opts.fileName,
    });
  };

  try {
    tick(2, "准备导出…");
    await opts.execute(tick);
    const done: ExportMeta = {
      ...opts.getExport(),
      exportStatus: "success",
      exportCount: opts.getExport().exportCount + 1,
      lastExportAt: new Date().toISOString(),
      lastExportType: opts.exportType,
      exportFileName: opts.fileName,
      exportProgress: 100,
      exportError: null,
      exportStageMessage: null,
      activeExportType: null,
    };
    opts.patchExport(done);
    return done;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failed: ExportMeta = {
      ...opts.getExport(),
      exportStatus: "failed",
      exportProgress: 0,
      exportError: msg,
      exportStageMessage: null,
      activeExportType: null,
    };
    opts.patchExport(failed);
    throw err;
  }
}

export function resetExportMeta(): ExportMeta {
  return createDefaultExportMeta();
}

export async function runStagedSteps(
  stages: readonly { pct: number; message: string }[],
  onProgress: (pct: number, message: string) => void,
  work: () => Promise<void>
): Promise<void> {
  for (const stage of stages) {
    onProgress(stage.pct, stage.message);
    await delay(120);
  }
  await work();
  onProgress(98, "即将完成…");
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
