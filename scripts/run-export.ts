/**
 * 无人值守导出成片：从 PG 读工作台 → 刷新剪辑图 → Render Engine → 写回成片 URL
 * 用法：AI_VIDEO_OS_ROOT=~/Desktop/AI-Veo npx tsx scripts/run-export.ts
 */
import fs from "fs";
import os from "os";
import path from "path";
import { Client } from "pg";

import {
  buildEditInputFromWorkbench,
  graphToSequence,
  syncClipAssetsFromWorkbench,
} from "../app/lib/auto-edit";
import { injectBgmIntoGraph } from "../app/lib/auto-edit/edit-graph/inject-bgm";
import { refreshEditGraphFromWorkbench } from "../app/lib/auto-edit/edit-graph/refresh-graph";
import { runRenderEngine } from "../app/lib/auto-edit/render-engine";
import type { T2VWorkbenchState } from "../app/lib/workbench-persist/types";

function loadEnvLocal(): void {
  const fp = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(fp)) return;
  for (const line of fs.readFileSync(fp, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  process.env.AI_VIDEO_OS_ROOT =
    process.env.AI_VIDEO_OS_ROOT ?? path.join(os.homedir(), "Desktop", "AI-Veo");

  const client = new Client({
    host: "localhost",
    port: 5433,
    user: "ai_cut",
    password: "ai_cut_dev",
    database: "ai_cut_v1",
  });
  await client.connect();

  const { rows } = await client.query(
    "SELECT id, ui_state FROM workbench_sessions ORDER BY updated_at DESC LIMIT 1"
  );
  const row = rows[0];
  if (!row) throw new Error("无 workbench_sessions");

  const ui = row.ui_state as { workbench?: T2VWorkbenchState };
  let wb = ui.workbench;
  if (!wb?.director?.storyboard?.length) throw new Error("无编导分镜");

  const shots = wb.director.storyboard.length;
  const targetMin = wb.targetDurationMinutes ?? 8;
  console.log(
    `项目：${wb.director.title ?? "未命名"} · ${shots} 镜 · 目标 ${targetMin} 分钟 · workspace ${process.env.AI_VIDEO_OS_ROOT}`
  );

  const input = buildEditInputFromWorkbench(wb);
  if (!input) throw new Error("buildEditInputFromWorkbench 失败");

  const refreshed = refreshEditGraphFromWorkbench(wb);
  if (!refreshed) throw new Error("refreshEditGraphFromWorkbench 失败");

  const editGraph = injectBgmIntoGraph(refreshed, wb.editBgmUrl, wb.editBgmVolume);
  if (!editGraph) throw new Error("injectBgmIntoGraph 失败");
  const sequence = syncClipAssetsFromWorkbench(graphToSequence(editGraph), input);

  const graphDur = editGraph.timeline.durationSec;
  const seqDur = sequence.totalDurationSec ?? sequence.playOrder.reduce(
    (s, k) => s + (sequence.clips[k]?.durationSec ?? 0),
    0
  );
  console.log(`时间线：graph ${graphDur.toFixed(1)}s · sequence ${seqDur.toFixed(1)}s`);

  const started = Date.now();
  const result = await runRenderEngine({
    sequence,
    editTimeline: editGraph.timeline,
    mediaPool: editGraph.mediaPool,
    aspectRatio: wb.aspectRatio ?? "9:16",
    fps: wb.fps ?? 24,
    mode: wb.editRenderMode ?? "mixed",
    bgmUrl: wb.editBgmUrl,
    bgmVolume: wb.editBgmVolume,
    voiceId: wb.editVoiceId,
    voiceProvider: wb.editEngineSettings?.voice.provider,
    engineSettings: wb.editEngineSettings,
    synthesizeVoice: true,
    targetDurationSec: targetMin > 0 ? Math.round(targetMin * 60) : undefined,
    onProgress: (pct, msg) => {
      process.stdout.write(`\r[${String(pct).padStart(3)}%] ${msg.slice(0, 72).padEnd(72)}`);
    },
  });
  console.log("");

  const elapsed = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`完成 · ${elapsed}s · ${result.outputUrl}`);

  const next: T2VWorkbenchState = {
    ...wb,
    editGraph,
    editSequence: graphToSequence(editGraph),
    finalEditVideoUrl: result.outputUrl,
    editRendering: false,
    editError: null,
    editRenderProgress: { pct: 100, message: "渲染完成" },
  };

  await client.query(
    "UPDATE workbench_sessions SET ui_state = $2::jsonb, sync_version = sync_version + 1, updated_at = NOW() WHERE id = $1",
    [row.id, JSON.stringify({ workbench: next })]
  );
  console.log("已写回 workbench_sessions.finalEditVideoUrl");
  await client.end();
}

main().catch((e) => {
  console.error("\n导出失败:", e);
  process.exit(1);
});
