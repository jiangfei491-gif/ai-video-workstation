import { runWorkspaceUnification } from "./run-unification";

async function main() {
  const report = await runWorkspaceUnification({
    execute: true,
    workbenchExportPath: process.env.WORKBENCH_EXPORT_PATH || undefined,
  });

  console.log(JSON.stringify(report, null, 2));

  console.log("\n=== AI Video OS 数据归一报告 ===");
  console.log(`Project: ${report.projects}`);
  console.log(`Material: ${report.materials}`);
  console.log(`Character: ${report.characters}`);
  console.log(`Asset(JSON): ${report.assets}`);
  console.log(`图片: ${report.images}`);
  console.log(`视频: ${report.videos}`);
  console.log(`音频: ${report.audio}`);
  console.log(`字幕: ${report.subtitles}`);
  console.log(`Workspace 容量: ${(report.workspaceBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Legacy 仍存在: ${report.legacyRemaining}`);
  console.log(`唯一 Workspace: ${report.isSingleWorkspace}`);
  if (report.errors.length) {
    console.error("错误:", report.errors.join("; "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
