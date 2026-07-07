import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDualWriteProxy } from "../repositories/dual-write/proxy";
import { createMemoryCache } from "../redis/cache";
import { createMemoryLock } from "../redis/lock";
import { createMemoryQueue } from "../redis/queue";
import { createMemorySse } from "../redis/sse";
import { getDefaultStorageProvider } from "../storage/factory";

describe("Storage & Redis (P2)", () => {
  it("Storage 默认 Local", async () => {
    const { getWorkspaceManager, resetWorkspaceManager } = await import("../workspace");
    resetWorkspaceManager();
    getWorkspaceManager().ensureLayout();
    const storage = getDefaultStorageProvider();
    assert.equal(storage.kind, "local");
    assert.equal(await storage.ping(), true);
  });

  it("Redis Memory Queue", async () => {
    const q = createMemoryQueue();
    await q.push("test", "hello");
    assert.equal(await q.length("test"), 1);
    assert.equal(await q.pop("test"), "hello");
  });

  it("Redis Memory Cache", async () => {
    const c = createMemoryCache();
    await c.set("k", "v");
    assert.equal(await c.get("k"), "v");
  });

  it("Redis Memory Lock", async () => {
    const l = createMemoryLock();
    assert.equal(await l.acquire("shot:1", 30, "tok"), true);
    assert.equal(await l.isLocked("shot:1"), true);
    assert.equal(await l.release("shot:1", "tok"), true);
  });

  it("Redis Memory SSE", async () => {
    const sse = createMemorySse();
    const messages: string[] = [];
    await sse.subscribe("job:1", (m) => messages.push(m));
    await sse.publish("job:1", "progress");
    assert.deepEqual(messages, ["progress"]);
  });

  it("Dual-write proxy 读 Legacy", async () => {
    const legacy = {
      findById: async (id: string) => ({ id, source: "legacy" }),
      create: async (x: unknown) => x,
    };
    const pg = {
      findById: async (id: string) => ({ id, source: "pg" }),
      create: async (x: unknown) => x,
    };
    const proxy = createDualWriteProxy(legacy, pg, {
      dualWriteEnabled: false,
      readSource: "legacy",
    });
    const row = await proxy.findById("1");
    assert.equal((row as { source: string }).source, "legacy");
  });
});
