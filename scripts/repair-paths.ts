/**
 * 修复库项路径 + 恢复误删：
 * DB local_path 可能指向旧临时路径；实际文件在 ~/Desktop/AI-Veo/storage/library/<lib>/<basename>。
 * 按文件名到新家找：找到就恢复(deleted_at=NULL)+改对 local_path；真没文件的保持删除。
 */
import fs from "node:fs";
import path from "node:path";

import { getOrCreateDefaultPool } from "@/database/repositories/pg/pool";

const HOME = "/Users/mac/Desktop/AI-Veo/storage/library";

async function main() {
  const pool = getOrCreateDefaultPool();
  const { rows } = await pool.query<{
    id: string;
    library_id: string;
    local_path: string | null;
    deleted_at: string | null;
  }>("SELECT id, library_id, local_path, deleted_at FROM resource_library_items");

  let ok = 0;
  let repathed = 0;
  let restored = 0;
  let stillOrphan = 0;

  for (const r of rows) {
    const base = r.local_path ? path.basename(r.local_path) : "";
    const homePath = base ? path.join(HOME, r.library_id, base) : "";
    const atLocal = r.local_path && fs.existsSync(r.local_path);
    const atHome = homePath && fs.existsSync(homePath);

    if (atLocal) {
      if (r.deleted_at) {
        await pool.query("UPDATE resource_library_items SET deleted_at=NULL, updated_at=NOW() WHERE id=$1", [r.id]);
        restored++;
      }
      ok++;
    } else if (atHome) {
      await pool.query(
        "UPDATE resource_library_items SET deleted_at=NULL, local_path=$2, updated_at=NOW() WHERE id=$1",
        [r.id, homePath]
      );
      repathed++;
      if (r.deleted_at) restored++;
    } else {
      stillOrphan++;
    }
  }

  console.log(`总记录 ${rows.length}`);
  console.log(`  路径本就正确 ${ok} · 改对路径 ${repathed} · 恢复误删 ${restored} · 真孤儿(保持删除) ${stillOrphan}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
