export type ExportStatus = "idle" | "exporting" | "success" | "failed";
export type ExportType = "project" | "video" | "images";

export type ExportMeta = {
  exportStatus: ExportStatus;
  exportProgress: number;
  exportCount: number;
  lastExportAt: string | null;
  lastExportType: ExportType | null;
  exportFileName: string | null;
  exportError: string | null;
  exportStageMessage: string | null;
  activeExportType: ExportType | null;
};

export const DEFAULT_EXPORT_META: ExportMeta = {
  exportStatus: "idle",
  exportProgress: 0,
  exportCount: 0,
  lastExportAt: null,
  lastExportType: null,
  exportFileName: null,
  exportError: null,
  exportStageMessage: null,
  activeExportType: null,
};

export function createDefaultExportMeta(): ExportMeta {
  return { ...DEFAULT_EXPORT_META };
}

export function normalizeExportMeta(meta: Partial<ExportMeta> | undefined): ExportMeta {
  if (!meta) return createDefaultExportMeta();
  const status =
    (meta.exportStatus as string) === "exported"
      ? "success"
      : meta.exportStatus === "exporting"
        ? "idle"
        : meta.exportStatus ?? "idle";
  return {
    ...DEFAULT_EXPORT_META,
    ...meta,
    exportStatus: status as ExportStatus,
    exportProgress: meta.exportProgress ?? 0,
    exportCount: meta.exportCount ?? 0,
    lastExportAt: meta.lastExportAt ?? null,
    lastExportType: meta.lastExportType ?? null,
    exportFileName: meta.exportFileName ?? null,
    exportError: meta.exportError ?? null,
    exportStageMessage: null,
    activeExportType: null,
  };
}

export function isExportSuccess(meta: ExportMeta | undefined): boolean {
  if (!meta) return false;
  return meta.exportStatus === "success" || (meta.exportStatus as string) === "exported";
}

export function exportStatusLabel(status: ExportStatus): string {
  switch (status) {
    case "idle":
      return "未导出";
    case "exporting":
      return "导出中";
    case "success":
      return "已导出";
    case "failed":
      return "导出失败";
    default:
      return "未导出";
  }
}

export function exportTypeLabel(type: ExportType | null): string {
  switch (type) {
    case "project":
      return "项目";
    case "video":
      return "视频";
    case "images":
      return "图片包";
    default:
      return "—";
  }
}

export function formatExportDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatExportDateShort(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const PROJECT_EXPORT_STAGES = [
  { pct: 12, message: "正在整理项目文件..." },
  { pct: 28, message: "正在生成配置文件..." },
  { pct: 48, message: "正在打包资源..." },
  { pct: 68, message: "正在压缩项目..." },
  { pct: 88, message: "正在生成下载文件..." },
] as const;

export const MEDIA_EXPORT_STAGES = [
  { pct: 15, message: "正在准备媒体文件..." },
  { pct: 40, message: "正在下载资源..." },
  { pct: 70, message: "正在写入文件..." },
  { pct: 90, message: "正在生成下载文件..." },
] as const;

export const IMAGES_PACK_STAGES = [
  { pct: 10, message: "正在整理图片..." },
  { pct: 30, message: "正在打包图片资源..." },
  { pct: 55, message: "正在压缩图片包..." },
  { pct: 80, message: "正在生成下载文件..." },
] as const;

/** @deprecated Legacy workbench export list */
export type LegacyExportRecord = {
  id: string;
  createdAt: string;
  kind: "video" | "image" | "project" | "prompt";
  label: string;
};

export function migrateLegacyExportRecords(
  records: LegacyExportRecord[] | undefined
): ExportMeta {
  if (!records?.length) return createDefaultExportMeta();
  const media = records.filter((r) => r.kind === "video" || r.kind === "image");
  if (!media.length) return createDefaultExportMeta();
  const first = media[0];
  return {
    exportStatus: "success",
    exportCount: media.length,
    lastExportAt: first?.createdAt ?? null,
    lastExportType: first?.kind === "video" ? "video" : "images",
    exportFileName: null,
    exportProgress: 0,
    exportError: null,
    exportStageMessage: null,
    activeExportType: null,
  };
}
