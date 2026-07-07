"use client";

import {
  appendClientWorkbenchActivity,
  patchClientWorkbenchActivity,
} from "./client-store";
import { resolveRouteActivityMeta } from "./route-labels";

const SKIP = /\/api\/workbench\/activity\b/;
// 流式(SSE)请求：header 一到 fetch 就 resolve，但主体还在流几分钟——
// 按「resolve = 完成」记录会误报「秒完成」。这类不跟踪，页内自有真进度。
const STREAMING = /(?:[?&]stream=(?:1|true)\b)/i;

let installed = false;
const inflight = new Map<string, string>();

function requestKey(url: string, method: string): string {
  return `${method}:${url}`;
}

function isNextInternalFetch(input: RequestInfo | URL, init?: RequestInit): boolean {
  try {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    );
    if (headers.get("RSC") === "1") return true;
    if (headers.has("Next-Router-State-Tree")) return true;
    if (headers.get("next-router-prefetch")) return true;
  } catch {
    /* ignore */
  }
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  return url.includes("_next/") || url.includes("__nextjs") || url.includes("?_rsc=");
}

export function installWorkbenchFetchTracker(): typeof fetch {
  if (installed || typeof window === "undefined") return fetch;
  installed = true;

  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (isNextInternalFetch(input, init)) {
      return original(input, init);
    }

    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    let activityId: string | undefined;
    let startMessage: string | undefined;
    if (method === "POST" && url.includes("/api/") && !SKIP.test(url) && !STREAMING.test(url)) {
      const meta = resolveRouteActivityMeta(url);
      if (meta) {
        startMessage = meta.startMessage;
        const row = appendClientWorkbenchActivity({
          moduleId: meta.moduleId,
          moduleLabel: meta.moduleLabel,
          actor: meta.actor,
          status: "running",
          message: meta.startMessage,
        });
        activityId = row.id;
        inflight.set(requestKey(url, method), row.id);

        void original("/api/workbench/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row),
        }).catch(() => {});
      }
    }

    try {
      const res = await original(input, init);
      if (activityId) {
        const ok = res.ok;
        const doneMessage = ok
          ? `${startMessage ?? "任务"} · 完成`
          : `${startMessage ?? "任务"} · 失败 (${res.status})`;
        patchClientWorkbenchActivity(activityId, {
          status: ok ? "success" : "failed",
          message: doneMessage,
        });
        void original("/api/workbench/activity", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: activityId,
            status: ok ? "success" : "failed",
            message: doneMessage,
          }),
        }).catch(() => {});
      }
      return res;
    } catch (e) {
      if (activityId) {
        const msg = e instanceof Error ? e.message : String(e);
        patchClientWorkbenchActivity(activityId, {
          status: "failed",
          message: "任务失败",
          detail: msg,
        });
        void original("/api/workbench/activity", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: activityId,
            status: "failed",
            message: "任务失败",
            detail: msg,
          }),
        }).catch(() => {});
      }
      throw e;
    } finally {
      if (activityId) inflight.delete(requestKey(url, method));
    }
  };

  return original;
}
