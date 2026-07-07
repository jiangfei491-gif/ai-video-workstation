import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { getWorkspaceManager } from "../../workspace";
import type { IPgPool } from "../../repositories/pg/pool";
import { DEFAULT_PROJECT_ID, DEFAULT_WORKSPACE_ID } from "./constants";

const EXT_KIND: Record<string, string> = {
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".webp": "image",
  ".gif": "image",
  ".mp4": "video",
  ".mov": "video",
  ".webm": "video",
  ".mp3": "audio",
  ".wav": "audio",
  ".m4a": "audio",
  ".aac": "audio",
  ".srt": "subtitle",
  ".ass": "subtitle",
  ".vtt": "subtitle",
};

function kindForFile(file: string): string {
  return EXT_KIND[path.extname(file).toLowerCase()] ?? "export";
}

function walkFiles(root: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(root)) return out;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const name of fs.readdirSync(dir)) {
      const fp = path.join(dir, name);
      const st = fs.statSync(fp);
      if (st.isDirectory()) stack.push(fp);
      else if (st.isFile()) out.push(fp);
    }
  }
  return out;
}

export async function scanStorageAssets(pool: IPgPool, projectId = DEFAULT_PROJECT_ID): Promise<number> {
  const ws = getWorkspaceManager();
  const storageRoot = ws.storageRoot;
  const files = walkFiles(storageRoot);
  let inserted = 0;

  for (const fp of files) {
    const rel = path.relative(storageRoot, fp).split(path.sep).join("/");
    const existing = await pool.queryOne<{ id: string }>(
      "SELECT id FROM assets WHERE workspace_id = $1 AND storage_key = $2",
      [DEFAULT_WORKSPACE_ID, rel]
    );
    if (existing) continue;

    const st = fs.statSync(fp);
    const hash = createHash("sha256").update(fs.readFileSync(fp)).digest("hex");
    const kind = kindForFile(fp);
    const publicUrl = `/api/files/${rel}`;

    await pool.query(
      `INSERT INTO assets (workspace_id, project_id, kind, storage_key, public_url, filename, size_bytes, sha256, legacy_filepath, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        DEFAULT_WORKSPACE_ID,
        rel.startsWith("projects/") ? projectId : null,
        kind,
        rel,
        publicUrl,
        path.basename(fp),
        st.size,
        hash,
        fp,
        JSON.stringify({ scanned: true }),
      ]
    );
    inserted += 1;
  }

  return inserted;
}

export function countFilesUnder(dir: string): number {
  return walkFiles(dir).length;
}
