/**
 * 通过 HTTP API 无人值守导出（需 dev server 运行中）
 * 用法：npx tsx scripts/run-export-via-api.ts
 */
import fs from "fs";
import path from "path";
import { Client } from "pg";

import { graphToSequence } from "../app/lib/auto-edit/edit-graph/timeline-bridge";
import { refreshEditGraphFromWorkbench } from "../app/lib/auto-edit/edit-graph/refresh-graph";
import type { T2VWorkbenchState } from "../app/lib/workbench-persist/types";

const BASE = process.env.RENDER_BASE_URL ?? "http://localhost:3000";

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

async function waitForServer(maxMs = 120_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/api/workbench/session`, { cache: "no-store" });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
    process.stdout.write(".");
  }
  throw new Error(`服务未就绪：${BASE}`);
}

async function pollJob(jobId: string): Promise<{ outputUrl?: string; error?: string }> {
  for (;;) {
    const res = await fetch(`${BASE}/api/auto-edit/jobs/${jobId}`, { cache: "no-store" });
    const data = (await res.json()) as {
      job?: { status: string; progress: number; message: string; outputUrl?: string; error?: string };
    };
    const job = data.job;
    if (!job) throw new Error("任务不存在");
    process.stdout.write(`\r[${String(job.progress).padStart(3)}%] ${job.message.slice(0, 70).padEnd(70)}`);
    if (job.status === "success") {
      console.log("");
      return { outputUrl: job.outputUrl };
    }
    if (job.status === "failed") {
      console.log("");
      return { error: job.error ?? job.message };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function main() {
  loadEnvLocal();
  console.log(`等待服务 ${BASE} …`);
  await waitForServer();
  console.log("\n服务就绪");

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
  const wb = (row.ui_state as { workbench: T2VWorkbenchState }).workbench;
  const shots = wb.director?.storyboard?.length ?? 0;
  console.log(`导出：${wb.director?.title ?? "项目"} · ${shots} 镜 · 目标 ${wb.targetDurationMinutes ?? 8} 分钟`);

  const graph = refreshEditGraphFromWorkbench(wb);
  if (graph) {
    wb.editGraph = graph;
    wb.editSequence = graphToSequence(graph);
  }

  const res = await fetch(`${BASE}/api/auto-edit/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workbench: wb, mode: wb.editRenderMode ?? "mixed" }),
  });
  const data = (await res.json()) as { jobId?: string; error?: string };
  if (!res.ok || !data.jobId) throw new Error(data.error ?? `渲染启动失败 ${res.status}`);

  console.log(`任务 ${data.jobId} 已启动`);
  const started = Date.now();
  const outcome = await pollJob(data.jobId);
  const elapsed = ((Date.now() - started) / 1000).toFixed(0);

  if (outcome.error || !outcome.outputUrl) {
    throw new Error(outcome.error ?? "无 outputUrl");
  }

  console.log(`完成 · ${elapsed}s · ${outcome.outputUrl}`);

  const next = {
    ...wb,
    finalEditVideoUrl: outcome.outputUrl,
    editRendering: false,
    editError: null,
    editRenderJobId: data.jobId,
    editRenderProgress: { pct: 100, message: "渲染完成" },
  };
  await client.query(
    "UPDATE workbench_sessions SET ui_state = $2::jsonb, sync_version = sync_version + 1, updated_at = NOW() WHERE id = $1",
    [row.id, JSON.stringify({ workbench: next })]
  );
  console.log("已写回数据库");
  await client.end();
}

main().catch((e) => {
  console.error("\n失败:", e instanceof Error ? e.message : e);
  process.exit(1);
});
