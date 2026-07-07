/**
 * 一次性回填：用 Gemini 视觉重新分析已入库的图片/视频/特效，补上精准标签+分类+描述+评分。
 * 顺带把 bug 窗口期存成 .bin 的文件改回正确扩展名。
 * 运行：npx tsx --env-file=.env.local scripts/backfill-vision.ts
 */
import fs from "node:fs";
import path from "node:path";

import { getResourceCenterPhase3Repos } from "@/database/repositories/resource-center";
import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import { runVisionResourceAnalysis, isVisionAvailable } from "@/app/lib/resource-center/phase3/ai-analyzer/vision-agent";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

const LIBS = ["image", "video", "effect"];
const CONCURRENCY = 4;

async function main() {
  if (!isVisionAvailable()) {
    console.log("未配置 Gemini key，退出");
    return;
  }
  const repos = getResourceCenterPhase3Repos();
  let totalCost = 0;
  const stats = { ok: 0, renamed: 0, missing: 0, failed: 0 };

  for (const lib of LIBS) {
    // 拉全部该库的项
    const items: { id: string; local_path: string; mime_type: string; title: string }[] = [];
    let offset = 0;
    for (;;) {
      const page = await repos.libraryItem.list(DEFAULT_WORKSPACE_ID, { library_id: lib, limit: 100, offset });
      items.push(...(page.items as never[]));
      if (page.items.length < 100) break;
      offset += 100;
    }
    console.log(`\n=== ${lib}: ${items.length} 条 ===`);

    // 简单并发
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (it) => {
          let filePath = it.local_path;
          try {
            if (!filePath || !fs.existsSync(filePath)) {
              stats.missing++;
              return;
            }
            // .bin → 正确扩展名
            if (filePath.endsWith(".bin")) {
              const ext = EXT_BY_MIME[it.mime_type] || "jpg";
              const newPath = filePath.replace(/\.bin$/, `.${ext}`);
              try {
                fs.renameSync(filePath, newPath);
                const newTitle = it.title.replace(/\.bin$/, `.${ext}`);
                await repos.libraryItem.update(it.id, { local_path: newPath, title: newTitle });
                filePath = newPath;
                stats.renamed++;
              } catch {
                /* 保持原路径 */
              }
            }

            const { result, cost } = await runVisionResourceAnalysis({
              filename: path.basename(filePath),
              localPath: filePath,
              mimeType: it.mime_type,
              fileSize: fs.statSync(filePath).size,
              sourceResourceTypes: [lib],
              sourceLanguage: "zh",
            });
            totalCost += cost;

            await repos.libraryItem.update(it.id, {
              category: result.category ?? undefined,
              tags: result.tags ?? [],
              keywords: result.keywords ?? result.tags ?? [],
              description: result.description ?? "",
              mood: result.mood ?? "",
              style: result.style ?? "",
              rating: result.rating ?? null,
              quality_score: result.qualityScore ?? null,
            } as never);
            stats.ok++;
          } catch (e) {
            stats.failed++;
            console.log(`  ✗ ${it.title}: ${(e as Error).message?.slice(0, 80)}`);
          }
        })
      );
      process.stdout.write(`\r  进度 ${Math.min(i + CONCURRENCY, items.length)}/${items.length}  (成功${stats.ok} 改名${stats.renamed} 缺失${stats.missing} 失败${stats.failed})`);
    }
  }

  console.log(`\n\n=== 完成 ===`);
  console.log(`成功 ${stats.ok} · 改名(.bin→正确) ${stats.renamed} · 文件缺失跳过 ${stats.missing} · 失败 ${stats.failed}`);
  console.log(`总成本 ≈ $${totalCost.toFixed(4)}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
