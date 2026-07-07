import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, afterEach } from "node:test";

import {
  getCrawlerManager,
  getDownloaderManager,
  getSourceManager,
  listCrawlerProviders,
  resolveDownloadsRoot,
} from "../../app/lib/resource-center/phase2";
import { DEFAULT_WORKSPACE_ID } from "../migrations/unification/constants";
import { ensureDefaultIdentity } from "../migrations/unification/bootstrap-db";
import { createPgPool } from "../repositories/pg/pool";
import { createResourceCenterRepos, resetResourceCenterReposCache } from "../repositories/resource-center";
import { createWorkspaceManager, resetWorkspaceManager } from "../workspace";

describe("Resource Center Phase 2", () => {
  let tmpRoot: string;
  const envKey = "AI_VIDEO_OS_ROOT";

  afterEach(() => {
    resetWorkspaceManager();
    resetResourceCenterReposCache();
    delete process.env[envKey];
  });

  function setupWorkspace() {
    tmpRoot = path.join(os.tmpdir(), `rc-p2-${Date.now()}`);
    process.env[envKey] = tmpRoot;
    resetWorkspaceManager();
    createWorkspaceManager(tmpRoot).ensureLayout();
  }

  it("CrawlerProvider 架构", () => {
    const providers = listCrawlerProviders();
    assert.ok(providers.length >= 2);
    assert.ok(providers.some((p) => p.slug === "generic-http"));
    assert.ok(providers.some((p) => p.slug === "generic-rss"));
  });

  it("downloads 目录", () => {
    setupWorkspace();
    const root = resolveDownloadsRoot();
    assert.ok(root.includes("storage"));
    assert.ok(root.includes("downloads"));
    assert.ok(fs.existsSync(root));
  });

  it("Source CRUD（需 PostgreSQL）", async () => {
    setupWorkspace();
    const pool = createPgPool();
    try {
      await ensureDefaultIdentity(pool);
      resetResourceCenterReposCache();
      const repos = createResourceCenterRepos(pool);
      const created = await repos.source.create(DEFAULT_WORKSPACE_ID, {
        name: "Test Source",
        url: "https://example.com",
        resource_types: ["image"],
        site_category: "image",
        provider_slug: "generic-http",
      });
      assert.ok(created.id);
      const listed = await repos.source.list(DEFAULT_WORKSPACE_ID);
      assert.ok(listed.total >= 1);
      await repos.source.softDelete(created.id);
    } finally {
      await pool.end();
    }
  });

  it("Crawler 任务入队", async () => {
    setupWorkspace();
    const pool = createPgPool();
    try {
      await ensureDefaultIdentity(pool);
      resetResourceCenterReposCache();
      const repos = createResourceCenterRepos(pool);
      const source = await repos.source.create(DEFAULT_WORKSPACE_ID, {
        name: "Crawl Test",
        url: "https://example.com",
        resource_types: ["music"],
        supports_crawler: true,
        provider_slug: "generic-http",
      });
      const manager = getCrawlerManager(repos);
      const task = await manager.start(source.id, DEFAULT_WORKSPACE_ID);
      assert.equal(task.status, "pending");
      await manager.stop(task.id);
      await repos.source.softDelete(source.id);
    } finally {
      await pool.end();
    }
  });
});
