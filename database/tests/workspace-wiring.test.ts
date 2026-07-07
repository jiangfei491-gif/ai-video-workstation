import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, afterEach } from "node:test";

import { resetWorkspaceManager } from "../workspace";

describe("Workspace V2 App Wiring", () => {
  const envKey = "AI_VIDEO_OS_ROOT";
  let prev: string | undefined;

  afterEach(() => {
    resetWorkspaceManager();
    if (prev === undefined) delete process.env[envKey];
    else process.env[envKey] = prev;
  });

  it("desktop-veo 委托 WorkspaceManager", async () => {
    prev = process.env[envKey];
    const tmp = path.join(os.tmpdir(), `ws-wire-${Date.now()}`);
    process.env[envKey] = tmp;

    const { createWorkspaceManager, resetWorkspaceManager: reset } = await import("../workspace");
    reset();
    createWorkspaceManager(tmp).ensureLayout();

    const { DESKTOP_VEO_DIRS, desktopBgmPath, ensureDesktopVeoLayout } = await import(
      "../../app/lib/storage/desktop-veo"
    );
    ensureDesktopVeoLayout();
    const bgm = desktopBgmPath("test.mp3");
    assert.ok(bgm.includes("bgm"));
    assert.ok(bgm.endsWith("test.mp3"));
  });

  it("production-json 读写 Workspace library", async () => {
    prev = process.env[envKey];
    const tmp = path.join(os.tmpdir(), `ws-wire-json-${Date.now()}`);
    process.env[envKey] = tmp;

    const { resetWorkspaceManager: reset } = await import("../workspace");
    reset();

    const { readProductionJson, writeProductionJson } = await import(
      "../../app/lib/storage/production-json"
    );
    writeProductionJson("_wiring-test.json", { ok: true });
    const data = readProductionJson("_wiring-test.json", { ok: false });
    assert.equal(data.ok, true);
    assert.ok(
      fs.existsSync(path.join(tmp, "storage", "library", "materials", "_wiring-test.json"))
    );
  });

  it("workspace-paths temp/cache/log 目录", async () => {
    prev = process.env[envKey];
    const tmp = path.join(os.tmpdir(), `ws-wire-paths-${Date.now()}`);
    process.env[envKey] = tmp;

    const { resetWorkspaceManager: reset } = await import("../workspace");
    reset();

    const { createTempDir, cacheDirFor, logDirFor, runtimeDataFilePath } = await import(
      "../../app/lib/storage/workspace-paths"
    );
    const dir = createTempDir("test-");
    assert.ok(fs.existsSync(dir));
    assert.ok(cacheDirFor("test-module").includes("cache"));
    assert.ok(logDirFor("test-module").includes("logs"));
    assert.ok(runtimeDataFilePath("x.json").includes("runtime"));
  });
});
