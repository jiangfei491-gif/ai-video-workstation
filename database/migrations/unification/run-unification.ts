import fs from "node:fs";
import path from "node:path";

import { getWorkspaceManager } from "../../workspace";
import { legacyImportSourceRoot } from "./legacy-import-source";
import { createPgPool } from "../../repositories/pg/pool";
import { tableCount } from "./bootstrap-db";
import { migrateLegacyFiles } from "./migrate-files";
import { migrateJsonLibraryToPg } from "./migrate-json-to-pg";
import { importWorkbenchExport } from "./import-workbench";
import { scanStorageAssets, countFilesUnder } from "./scan-assets";
import { markWorkspaceUnified } from "./unified-mode";
import { DEFAULT_PROJECT_ID, DEFAULT_WORKSPACE_ID } from "./constants";
import type { UnificationReport } from "./types";

function dirSize(root: string): number {
  let total = 0;
  if (!fs.existsSync(root)) return 0;
  for (const fp of walkAll(root)) {
    try {
      total += fs.statSync(fp).size;
    } catch {
      /* skip */
    }
  }
  return total;
}

function walkAll(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const name of fs.readdirSync(dir)) {
      const fp = path.join(dir, name);
      try {
        const st = fs.statSync(fp);
        if (st.isDirectory()) stack.push(fp);
        else out.push(fp);
      } catch {
        /* skip */
      }
    }
  }
  return out;
}

function auditCodebaseAccess(): {
  desktop: string[];
  localStorage: string[];
  absolutePath: string[];
} {
  const root = path.join(process.cwd(), "app");
  const desktop: string[] = [];
  const localStorage: string[] = [];
  const absolutePath: string[] = [];

  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const fp = path.join(dir, name);
      if (fs.statSync(fp).isDirectory()) {
        walk(fp);
        continue;
      }
      if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
      const rel = path.relative(process.cwd(), fp);
      const content = fs.readFileSync(fp, "utf8");
      if (content.includes("Desktop/AI-Veo") || content.includes('path.join(os.homedir(), "Desktop"')) {
        if (!rel.includes("workspace-paths.ts") && !rel.includes("unified-mode")) {
          desktop.push(rel);
        }
      }
      if (content.includes("localStorage.") && !rel.includes("workbench-persist/server-store")) {
        localStorage.push(rel);
      }
      if (content.includes("os.tmpdir()") && !rel.includes("workspace-paths")) {
        absolutePath.push(rel);
      }
    }
  };
  if (fs.existsSync(root)) walk(root);
  return { desktop, localStorage, absolutePath };
}

export async function runWorkspaceUnification(options?: {
  workbenchExportPath?: string;
  execute?: boolean;
}): Promise<UnificationReport> {
  const ws = getWorkspaceManager();
  ws.ensureLayout({ includeProjectId: DEFAULT_PROJECT_ID });
  const errors: string[] = [];
  const legacyRoot = legacyImportSourceRoot();

  const report: UnificationReport = {
    migratedAt: new Date().toISOString(),
    workspaceRoot: ws.workspaceRoot,
    legacyRoot,
    projects: 0,
    materials: 0,
    characters: 0,
    scenes: 0,
    props: 0,
    assets: 0,
    images: 0,
    videos: 0,
    audio: 0,
    subtitles: 0,
    exports: 0,
    opencutFiles: 0,
    workbenchSessions: 0,
    postgresRows: {},
    workspaceBytes: 0,
    legacyRemaining: fs.existsSync(legacyRoot),
    desktopAccessModules: [],
    localStorageModules: [],
    absolutePathModules: [],
    isSingleWorkspace: false,
    errors,
  };

  if (options?.execute === false) {
    report.errors.push("dry-run only");
    return report;
  }

  const fileStats = migrateLegacyFiles(DEFAULT_PROJECT_ID);
  report.images = fileStats.images;
  report.videos = fileStats.videos;
  report.audio = fileStats.audio;
  report.subtitles = fileStats.subtitles;
  report.exports = fileStats.exports;
  report.opencutFiles = fileStats.opencut;

  let pool;
  try {
    pool = createPgPool();
    await pool.query("SELECT 1");
  } catch (e) {
    errors.push(`PostgreSQL 不可用: ${e instanceof Error ? e.message : String(e)}`);
    return report;
  }

  try {
    const jsonCounts = await migrateJsonLibraryToPg(pool);
    report.materials = jsonCounts.materials;
    report.characters = jsonCounts.characters;
    report.scenes = jsonCounts.scenes;
    report.props = jsonCounts.props;
    report.assets = jsonCounts.assets;

    const scanned = await scanStorageAssets(pool, DEFAULT_PROJECT_ID);
    report.assets += scanned;

    const exportPath =
      options?.workbenchExportPath ??
      path.join(ws.workspaceRoot, "backups", "workbench-export.json");
    report.workbenchSessions = await importWorkbenchExport(pool, exportPath);

    report.projects = await tableCount(pool, "projects");

    for (const table of [
      "materials",
      "characters",
      "scenes",
      "props",
      "assets",
      "projects",
      "workbench_sessions",
      "timelines",
      "jobs",
      "cost_ledger",
    ]) {
      report.postgresRows[table] = await tableCount(pool, table);
    }

    markWorkspaceUnified({
      defaultWorkspaceId: DEFAULT_WORKSPACE_ID,
      defaultProjectId: DEFAULT_PROJECT_ID,
      migratedAt: report.migratedAt,
      reportPath: path.join(ws.workspaceRoot, "UNIFICATION_REPORT.json"),
    });

    fs.writeFileSync(
      path.join(ws.workspaceRoot, "UNIFICATION_REPORT.json"),
      JSON.stringify(report, null, 2),
      "utf8"
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  } finally {
    await pool.end();
  }

  report.workspaceBytes = dirSize(ws.workspaceRoot);
  const pp = ws.getProjectPaths(DEFAULT_PROJECT_ID);
  report.images = Math.max(report.images, countFilesUnder(pp.images));
  report.videos = Math.max(report.videos, countFilesUnder(pp.videos));
  report.audio = Math.max(report.audio, countFilesUnder(pp.audio));

  const audit = auditCodebaseAccess();
  report.desktopAccessModules = audit.desktop;
  report.localStorageModules = audit.localStorage;
  report.absolutePathModules = audit.absolutePath;
  report.legacyRemaining = fs.existsSync(legacyRoot);
  report.isSingleWorkspace =
    report.postgresRows.projects > 0 &&
    report.workspaceBytes > 0 &&
    audit.desktop.length === 0;

  return report;
}
