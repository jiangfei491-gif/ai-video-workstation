import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, afterEach } from "node:test";

import {
  getLibraryManager,
  LIBRARY_IDS,
  LIBRARY_DEFINITIONS,
  resetLibraryManager,
  RESOURCE_CENTER_LIBRARY_REL,
} from "../../app/lib/resource-center";
import { createWorkspaceManager, resetWorkspaceManager } from "../workspace";

describe("Resource Center V1", () => {
  let tmpRoot: string;
  const envKey = "AI_VIDEO_OS_ROOT";

  afterEach(() => {
    resetLibraryManager();
    resetWorkspaceManager();
    delete process.env[envKey];
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  function setup() {
    tmpRoot = path.join(os.tmpdir(), `rc-v1-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    process.env[envKey] = tmpRoot;
    resetWorkspaceManager();
    resetLibraryManager();
    createWorkspaceManager(tmpRoot);
  }

  it("12 个内容库定义完整", () => {
    assert.equal(LIBRARY_DEFINITIONS.length, 12);
    assert.equal(LIBRARY_IDS.length, 12);
    for (const id of LIBRARY_IDS) {
      assert.ok(id in RESOURCE_CENTER_LIBRARY_REL);
    }
  });

  it("Library Manager 统一接口", async () => {
    setup();
    const manager = getLibraryManager();
    const libs = manager.listLibraries();
    assert.equal(libs.length, 12);
    for (const lib of libs) {
      assert.equal(typeof lib.getStoragePath, "function");
      assert.equal(typeof lib.ensureLayout, "function");
      assert.equal(typeof lib.getStats, "function");
      assert.equal(typeof lib.list, "function");
      const result = await lib.list();
      assert.deepEqual(result.items, []);
    }
  });

  it("ensureAllLayouts 创建 storage/library 下 12 目录", () => {
    setup();
    const manager = getLibraryManager();
    const manifest = manager.ensureAllLayouts();
    assert.equal(manifest.libraryIds.length, 12);
    for (const id of LIBRARY_IDS) {
      const dir = path.join(tmpRoot, "storage", "library", RESOURCE_CENTER_LIBRARY_REL[id]);
      assert.ok(fs.existsSync(dir), `missing ${dir}`);
      assert.ok(fs.existsSync(path.join(dir, ".meta", "library.json")));
    }
    assert.ok(fs.existsSync(path.join(tmpRoot, "storage", "library", ".resource-center-manifest.json")));
  });
});
