import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, afterEach } from "node:test";

import {
  getAIResourceService,
  guessLibraryFromFilename,
  isDeepSeekAvailable,
  ruleBasedAnalysis,
} from "../../app/lib/resource-center/phase3";
import { LIBRARY_IDS } from "../../app/lib/resource-center/libraries/definitions";
import { DEFAULT_WORKSPACE_ID } from "../migrations/unification/constants";
import { ensureDefaultIdentity } from "../migrations/unification/bootstrap-db";
import { createPgPool } from "../repositories/pg/pool";
import {
  createResourceCenterPhase3Repos,
  resetResourceCenterReposCache,
} from "../repositories/resource-center";
import { createWorkspaceManager, resetWorkspaceManager } from "../workspace";

describe("Resource Center Phase 3", () => {
  const envKey = "AI_VIDEO_OS_ROOT";

  afterEach(() => {
    resetWorkspaceManager();
    resetResourceCenterReposCache();
    delete process.env[envKey];
  });

  function setupWorkspace() {
    const tmpRoot = path.join(os.tmpdir(), `rc-p3-${Date.now()}`);
    process.env[envKey] = tmpRoot;
    resetWorkspaceManager();
    createWorkspaceManager(tmpRoot).ensureLayout();
    return tmpRoot;
  }

  it("DeepSeek agent 规则回退", () => {
    const result = ruleBasedAnalysis({
      filename: "hero-shot.mp4",
      localPath: "/tmp/hero-shot.mp4",
      mimeType: "video/mp4",
      fileSize: 1024,
      sourceResourceTypes: ["video"],
    });
    assert.equal(result.libraryId, "video");
    assert.ok(result.canImport);
  });

  it("guessLibraryFromFilename 覆盖 12 库扩展名", () => {
    assert.equal(guessLibraryFromFilename("a.jpg"), "image");
    assert.equal(guessLibraryFromFilename("b.mp4"), "video");
    assert.equal(guessLibraryFromFilename("c.mp3"), "music");
    assert.equal(guessLibraryFromFilename("d.srt"), "subtitle");
    assert.ok(LIBRARY_IDS.length === 12);
  });

  it("AI Resource Service 支持 12 库", () => {
    const svc = getAIResourceService();
    assert.deepEqual(svc.supportedLibraries().length, 12);
  });

  it("Library Item CRUD（需 PostgreSQL + Phase3 schema）", async () => {
    const tmpRoot = setupWorkspace();
    const pool = createPgPool();
    try {
      await ensureDefaultIdentity(pool);
      resetResourceCenterReposCache();
      const repos = createResourceCenterPhase3Repos(pool);

      const storageDir = path.join(tmpRoot, "storage/library/image");
      fs.mkdirSync(storageDir, { recursive: true });
      const filePath = path.join(storageDir, "test.png");
      fs.writeFileSync(filePath, Buffer.from("fake"));

      const item = await repos.libraryItem.create({
        workspace_id: DEFAULT_WORKSPACE_ID,
        library_id: "image",
        download_task_id: null,
        analysis_task_id: null,
        import_task_id: null,
        source_id: null,
        title: "Test Image",
        description: "phase3 test",
        category: "general",
        language: "zh",
        style: "photo",
        mood: "neutral",
        purpose: "test",
        platform: "general",
        status: "imported",
        rating: 4,
        quality_score: 0.9,
        enabled: true,
        favorite: false,
        local_path: filePath,
        thumbnail_path: filePath,
        preview_path: filePath,
        tags: ["test", "image"],
        keywords: ["test"],
        sha256: "a".repeat(64),
        file_size: 4,
        mime_type: "image/png",
        metadata: {},
        db_primary_table: "assets",
        db_record_id: null,
      });

      assert.ok(item.id);
      const found = await repos.libraryItem.findById(item.id);
      assert.equal(found?.title, "Test Image");

      const search = await repos.libraryItem.list(DEFAULT_WORKSPACE_ID, {
        library_id: "image",
        q: "Test",
      });
      assert.ok(search.total >= 1);

      await repos.libraryItem.softDelete(item.id);
    } finally {
      await pool.end();
    }
  });

  it("isDeepSeekAvailable 可读环境", () => {
    assert.equal(typeof isDeepSeekAvailable(), "boolean");
  });
});
