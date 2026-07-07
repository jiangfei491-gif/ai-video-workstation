import { getIcProviderForPlatform } from "./crawler/registry";
import { addDiscoveries, attachScores } from "./discoveries/store";
import { logEvent } from "./event-log/store";
import { getSettings } from "./settings/store";
import { listSavedSources, updateSavedSource, type IcSavedSource } from "./sources/store";
import { enqueueScored } from "./review-queue/queue";
import { scoreItems } from "./analyzer/scorer";
import type { IcModelId } from "./analyzer/models";
import type { IcSource } from "./types";

/**
 * 后台自动抓取调度器（进程内单例 setInterval）。
 * 每分钟 tick 一次，跑到期的订阅源：发现→去重存档→记日志→（可选）便宜档打分。
 * 由 instrumentation.ts 在服务器启动时 startScheduler()。
 */

const TICK_MS = 60_000;
const MAX_PAGES = 20; // 翻页轮转上限，跑到底或到此回卷到第 1 页
const inFlight = new Set<string>();

function isDue(s: IcSavedSource, now: number): boolean {
  if (!s.enabled) return false;
  if (!s.lastRunAt) return true;
  return new Date(s.lastRunAt).getTime() + s.intervalMinutes * 60_000 <= now;
}

/** 立即跑一个源（供调度器与「立即运行」按钮复用） */
export async function runSource(source: IcSavedSource): Promise<{ found: number; error?: string }> {
  if (inFlight.has(source.id)) return { found: 0, error: "运行中" };
  inFlight.add(source.id);
  try {
    const provider = getIcProviderForPlatform(source.platformId);
    if (!provider || !provider.connected) {
      updateSavedSource(source.id, { lastRunAt: new Date().toISOString(), lastError: "平台未接入" });
      return { found: 0, error: "平台未接入" };
    }
    const pageSize = getSettings().discoverPageSize;
    const icSource: IcSource = {
      id: source.id,
      platformId: source.platformId,
      name: source.name,
      providerSlug: provider.slug,
      query: source.query,
      enabled: true,
      requiresToken: true,
      createdAt: source.createdAt,
    };
    const page = source.nextPage && source.nextPage > 0 ? source.nextPage : 1;
    const { items, hasMore } = await provider.discover(icSource, { page, pageSize });
    const added = addDiscoveries(source.id, items);
    // 翻页轮转：还有下一页就往深了翻，跑到底/到上限回卷到第 1 页
    const nextPage = hasMore && page < MAX_PAGES ? page + 1 : 1;
    logEvent({
      platformId: source.platformId,
      kind: "discover",
      level: "info",
      message: `自动抓取「${source.name}」第 ${page} 页：新增 ${added.length}/${items.length} 项`,
      meta: { sourceId: source.id, page, nextPage, newCount: added.length, total: items.length, auto: true },
    });

    if (source.autoScore && added.length) {
      try {
        const s = getSettings();
        const run = await scoreItems(
          added.map((d) => d.item),
          { cheapModel: s.defaultAnalyzerModel as IcModelId, useStrong: false },
        );
        attachScores(
          run.items.map((x) => ({
            item: { id: x.item.id },
            score: x.score,
            module: x.module,
            worth: x.worth,
            reason: x.reason,
            scoredBy: x.scoredBy,
            tags: x.tags,
            advice: x.advice,
          })),
        );
        logEvent({
          platformId: source.platformId,
          kind: "score",
          level: "info",
          message: `自动打分「${source.name}」${added.length} 项 · ${run.cheapModel} · $${run.costUsd.toFixed(5)}`,
          meta: { sourceId: source.id, costUsd: run.costUsd, auto: true },
        });

        // 自动加入审核：达到分数线的项目免手动点，直接进审核队列（安装仍需人工通过）
        if (s.autoEnqueue) {
          const picked = run.items.filter((x) => x.score >= s.minScoreToRecommend);
          for (const x of picked) {
            enqueueScored({
              item: x.item,
              score: x.score,
              module: x.module,
              worth: x.worth,
              reason: x.reason,
              tags: x.tags,
              scoredBy: x.scoredBy,
            });
          }
          if (picked.length) {
            logEvent({
              platformId: source.platformId,
              kind: "enqueue",
              level: "info",
              message: `自动加入审核「${source.name}」${picked.length} 项（≥${s.minScoreToRecommend} 分）`,
              meta: { sourceId: source.id, count: picked.length, auto: true },
            });
          }
        }
      } catch (e) {
        logEvent({ platformId: source.platformId, kind: "score", level: "warn", message: `自动打分失败：${(e as Error).message}` });
      }
    }

    updateSavedSource(source.id, {
      lastRunAt: new Date().toISOString(),
      lastCount: added.length,
      lastError: null,
      nextPage,
    });
    return { found: added.length };
  } catch (e) {
    const msg = (e as Error).message;
    updateSavedSource(source.id, { lastRunAt: new Date().toISOString(), lastError: msg });
    logEvent({ platformId: source.platformId, kind: "discover", level: "error", message: `自动抓取失败「${source.name}」：${msg}` });
    return { found: 0, error: msg };
  } finally {
    inFlight.delete(source.id);
  }
}

async function tick(): Promise<void> {
  const now = Date.now();
  const due = listSavedSources().filter((s) => isDue(s, now));
  for (const s of due) {
    // 串行跑，避免同时打爆外部 API
    await runSource(s);
  }
}

type SchedulerGlobal = typeof globalThis & { __icSchedulerStarted?: boolean };

export function startScheduler(): void {
  const g = globalThis as SchedulerGlobal;
  if (g.__icSchedulerStarted) return;
  g.__icSchedulerStarted = true;
  // 启动几秒后先跑一轮，之后每分钟一次
  setTimeout(() => {
    void tick();
  }, 8_000);
  setInterval(() => {
    void tick();
  }, TICK_MS);
}
