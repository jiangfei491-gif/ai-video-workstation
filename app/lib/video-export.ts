import { downloadBlob, fetchAsUint8Array } from "@/app/lib/export/download";

export async function exportVideoFile(
  videoUrl: string,
  filename: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  onProgress?.(8);
  const data = await fetchAsUint8Array(videoUrl, (p) =>
    onProgress?.(15 + Math.round(p * 0.75))
  );
  onProgress?.(95);
  const type = filename.endsWith(".mp4") ? "video/mp4" : "image/png";
  downloadBlob(new Blob([Uint8Array.from(data)], { type }), filename);
  onProgress?.(100);
}
