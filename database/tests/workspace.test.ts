import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, afterEach } from "node:test";

import {
  createWorkspaceManager,
  resetWorkspaceManager,
  resolveAbsolute,
  WORKSPACE_VERSION,
} from "../workspace";

describe("WorkspaceManager V2", () => {
  let tmpRoot: string;

  afterEach(() => {
    resetWorkspaceManager();
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      } catch {
        /* 并发备份可能短暂占用目录 */
      }
    }
  });

  function wsRoot(): string {
    tmpRoot = path.join(os.tmpdir(), `ai-video-os-v2-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    return tmpRoot;
  }

  it("默认结构路径", () => {
    const ws = createWorkspaceManager(wsRoot());
    const p = ws.getPaths();
    assert.equal(p.workspaceRoot, resolveAbsolute(tmpRoot));
    assert.ok(p.projectsRoot.endsWith(path.join("storage", "projects")));
    assert.ok(p.modelRoot.endsWith("models"));
    assert.ok(p.logRoot.endsWith("logs"));
    assert.ok(p.exportRoot.endsWith(path.join("storage", "exports")));
    assert.ok(p.pluginRoot.endsWith("plugins"));
    assert.ok(p.backupRoot.endsWith("backups"));
  });

  it("项目子目录 V2", () => {
    const ws = createWorkspaceManager(wsRoot());
    const pp = ws.getProjectPaths("proj-123");
    assert.ok(pp.videos.endsWith(path.join("proj-123", "videos")));
    assert.ok(pp.opencut.endsWith("opencut"));
    assert.ok(pp.metadata.endsWith("metadata"));
    assert.ok(pp.thumbnails.endsWith("thumbnails"));
    assert.ok(pp.director.endsWith("director"));
    assert.ok(pp.subtitleJson.endsWith("subtitle-json"));
  });

  it("Library / Model 路径", () => {
    const ws = createWorkspaceManager(wsRoot());
    const lib = ws.getLibraryPaths();
    assert.ok(lib.sfx.endsWith(path.join("library", "sfx")));
    assert.ok(lib.lora.endsWith("lora"));
    const models = ws.getModelPaths();
    assert.ok(models.whisper.endsWith(path.join("models", "whisper")));
    assert.ok(models.custom.endsWith("custom"));
  });

  it("ensureLayout 创建完整 V2 目录", () => {
    const ws = createWorkspaceManager(wsRoot());
    ws.ensureLayout({ includeProjectId: "test-proj" });
    assert.ok(fs.existsSync(ws.databaseRoot));
    assert.ok(fs.existsSync(ws.storageRoot));
    assert.ok(fs.existsSync(ws.getProjectPaths("test-proj").videos));
    assert.ok(fs.existsSync(ws.getLibraryPaths().transitions));
    assert.ok(fs.existsSync(ws.getModelPaths().comfyui));
    const cfg = path.join(ws.workspaceRoot, "workspace.json");
    assert.ok(fs.existsSync(cfg));
  });

  it("checkAndRepair 自动修复缺失目录", () => {
    const ws = createWorkspaceManager(wsRoot());
    const result = ws.checkAndRepair();
    assert.equal(result.ok, true);
    assert.ok(fs.existsSync(ws.pluginRoot));
  });

  it("runHealthCheck", async () => {
    const ws = createWorkspaceManager(wsRoot());
    ws.ensureLayout();
    const report = await ws.runHealthCheck();
    assert.ok(report.checkedAt);
    assert.equal(report.workspaceRoot, ws.workspaceRoot);
    assert.ok(report.items.length > 0);
  });

  it("backup / restore / delete", async () => {
    const ws = createWorkspaceManager(wsRoot());
    ws.ensureLayout();
    const created = await ws.createBackup({ type: "manual" });
    assert.equal(created.success, true);
    const list = ws.listBackups();
    assert.ok(list.length >= 1);
    const dry = await ws.restoreBackup(list[0]!.id, { dryRun: true });
    assert.equal(dry.success, true);
    const del = ws.deleteBackup(list[0]!.id);
    assert.equal(del.success, true);
  });

  it("relocateWorkspacePath 仅改指针不复制数据", () => {
    const root = wsRoot();
    const ws = createWorkspaceManager(root);
    ws.ensureLayout();
    const newRoot = path.join(root, "moved");
    const r = ws.relocateWorkspacePath(newRoot);
    assert.equal(r.success, true);
    assert.equal(r.dataCopied, false);
    assert.equal(ws.workspaceRoot, resolveAbsolute(newRoot));
  });

  it("setWorkspaceRoot 可配置", () => {
    const ws = createWorkspaceManager(wsRoot());
    const custom = path.join(tmpRoot, "custom-workspace");
    ws.setWorkspaceRoot(custom);
    assert.equal(ws.workspaceRoot, resolveAbsolute(custom));
  });

  it("workspace.json version", () => {
    const ws = createWorkspaceManager(wsRoot());
    ws.ensureLayout();
    const cfg = ws.loadConfig();
    assert.equal(cfg.version, WORKSPACE_VERSION);
  });

  it("libraryJsonPath 指向 Workspace library", () => {
    const ws = createWorkspaceManager(wsRoot());
    ws.ensureLayout();
    const fp = ws.libraryJsonPath("materials.json");
    assert.ok(fp.includes(path.join("library", "materials")));
    assert.ok(fp.endsWith("materials.json"));
  });

  it("cleanCache", async () => {
    const ws = createWorkspaceManager(wsRoot());
    ws.ensureLayout();
    fs.writeFileSync(path.join(ws.cacheRoot, "tmp.bin"), "x");
    const r = await ws.cleanCache({ dryRun: false });
    assert.ok(r.removed.length >= 1);
  });
});
