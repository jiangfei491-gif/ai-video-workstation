export function triggerDownload(href: string, filename: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (href.startsWith("blob:")) {
    setTimeout(() => URL.revokeObjectURL(href), 5000);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  triggerDownload(URL.createObjectURL(blob), filename);
}

export function downloadText(filename: string, content: string): void {
  downloadBlob(new Blob([content], { type: "text/plain;charset=utf-8" }), filename);
}

export function downloadJson(filename: string, data: unknown): void {
  downloadText(filename, JSON.stringify(data, null, 2));
}

export async function fetchAsUint8Array(
  url: string,
  onProgress?: (pct: number) => void
): Promise<Uint8Array> {
  if (url.startsWith("data:")) {
    onProgress?.(50);
    const res = await fetch(url);
    const blob = await res.blob();
    onProgress?.(85);
    return new Uint8Array(await blob.arrayBuffer());
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error("资源下载失败");
  const len = Number(res.headers.get("content-length")) || 0;
  const body = res.body;

  if (!body || len <= 0) {
    onProgress?.(60);
    const buf = await res.arrayBuffer();
    onProgress?.(90);
    return new Uint8Array(buf);
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress?.(Math.min(90, Math.round((received / len) * 90)));
    }
  }

  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
