/**
 * 公版歌词入库流水线（唯一入口：用户粘贴导入）
 * 待入库队列 → 抓取 → 正文校验 → GPT 解析评分 → 入库
 */
import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import {
  addEvidence,
  finishSyncRun,
  insertPublicLyric,
  publicLyricExists,
  registerStorageFile,
  saveSettings,
  startSyncRun,
} from "./repository";
import { musicGptModel, parseAndClassify, passesPublicScoreGate } from "./gpt-agent";
import { listPendingSeeds, reconcileSeedStatus, upsertSeedStatus } from "./seed-store";
import { dedupeKey } from "./dedupe";
import { MIN_PUBLIC_OVERALL_SCORE, type MusicSeedTrack } from "./types";
import { sha256Text, writeImmutableFile } from "./storage";

const MIN_PLAIN_TEXT_CHARS = 200;
const DEFAULT_LIMIT = 30;

let syncing = false;

export type SyncResult = {
  found: number;
  added: number;
  skipped: number;
  rejectedScore: number;
  failed: number;
  model: string;
  error?: string;
};

export async function runPublicSync(
  trigger: "manual" | "import",
  workspaceId = DEFAULT_WORKSPACE_ID,
  opts?: { limit?: number }
): Promise<SyncResult> {
  if (syncing) {
    return {
      found: 0,
      added: 0,
      skipped: 0,
      rejectedScore: 0,
      failed: 0,
      model: "",
      error: "入库进行中",
    };
  }
  syncing = true;

  const limit = Math.max(1, opts?.limit ?? DEFAULT_LIMIT);
  const runId = await startSyncRun(trigger, musicGptModel(), workspaceId);
  const result: SyncResult = {
    found: 0,
    added: 0,
    skipped: 0,
    rejectedScore: 0,
    failed: 0,
    model: musicGptModel(),
  };

  try {
    await reconcileSeedStatus(workspaceId);
    const queue = await listPendingSeeds({ limit, workspaceId });
    result.found = queue.length;

    for (const track of queue) {
      try {
        const handled = await ingestTrack(track, workspaceId);
        if (handled === "added") result.added++;
        else if (handled === "rejected_score") result.rejectedScore++;
        else result.skipped++;
        const status =
          handled === "added" ? "ingested" : handled === "rejected_score" ? "rejected" : "skipped";
        await upsertSeedStatus(track.id, status, workspaceId);
      } catch (e) {
        result.failed++;
        await upsertSeedStatus(track.id, "failed", workspaceId, {
          error: e instanceof Error ? e.message : String(e),
          incrementAttempt: true,
        });
      }
    }

    await saveSettings({ lastSyncAt: new Date().toISOString() }, workspaceId);
    await finishSyncRun(runId, { status: "success", ...counts(result) });
    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    result.error = error;
    await finishSyncRun(runId, { status: "failed", ...counts(result), error });
    return result;
  } finally {
    syncing = false;
  }
}

function counts(r: SyncResult) {
  return { found: r.found, added: r.added, skipped: r.skipped, failed: r.failed };
}

function plainTextLength(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

async function ingestTrack(
  track: MusicSeedTrack,
  workspaceId: string
): Promise<"added" | "skipped" | "rejected_score"> {
  const key = dedupeKey(track.title, track.author);
  if (await publicLyricExists(key, workspaceId)) return "skipped";
  if (!track.sourceUrl?.trim()) return "skipped";

  const res = await fetch(track.sourceUrl, {
    headers: { "User-Agent": "AI-Video-Workstation-MusicModule/2.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "text/html";
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 80) throw new Error("网页内容为空");

  const rawText = buf.toString("utf8");
  if (plainTextLength(rawText) < MIN_PLAIN_TEXT_CHARS) return "skipped";

  const ext = contentType.includes("pdf") ? "pdf" : contentType.includes("json") ? "json" : "html";
  const rawStored = writeImmutableFile("sources", `crawl-${key.slice(0, 40)}.${ext}`, buf, contentType);
  const rawFileId = await registerStorageFile(rawStored, workspaceId);

  const { parsed, model } = await parseAndClassify(rawText, track.sourceUrl, track.note);
  if (!parsed.body) return "skipped";
  if (!parsed.isPublicDomain) return "skipped";

  const parsedStored = writeImmutableFile(
    "parsed",
    `parsed-${key.slice(0, 40)}.json`,
    JSON.stringify({ ...parsed, sourceUrl: track.sourceUrl, model, importNote: track.note }, null, 2),
    "application/json"
  );
  await registerStorageFile(parsedStored, workspaceId);

  if (!passesPublicScoreGate(parsed.scores)) return "rejected_score";

  const contentStored = writeImmutableFile(
    "public",
    `lyric-${key.slice(0, 40)}.txt`,
    parsed.body,
    "text/plain; charset=utf-8"
  );
  const contentFileId = await registerStorageFile(contentStored, workspaceId);

  const finalTitle = parsed.title || track.title;
  const finalAuthor = parsed.author || track.author;
  const finalKey = dedupeKey(finalTitle, finalAuthor);
  if (finalKey !== key && (await publicLyricExists(finalKey, workspaceId))) return "skipped";

  const lyric = await insertPublicLyric(
    {
      title: finalTitle,
      titleZh: parsed.titleZh,
      author: finalAuthor,
      birthYear: parsed.birthYear,
      deathYear: parsed.deathYear,
      country: parsed.country,
      language: parsed.language,
      firstPublished: parsed.firstPublished,
      sourceUrl: track.sourceUrl,
      category: parsed.category,
      moodTags: parsed.moodTags,
      sceneTags: parsed.sceneTags,
      styleTags: parsed.styleTags,
      themeTags: [],
      commercialTags: parsed.commercialTags,
      overallScore: parsed.scores.overall,
      coverHotness: parsed.coverAnalysis.stars,
      scoreDetails: { ...parsed.scores, coverAnalysis: parsed.coverAnalysis },
      body: parsed.body,
      lyricZhRemark: parsed.lyricZhRemark,
      dedupeKey: finalKey,
      fingerprint: sha256Text(parsed.body),
      contentFileId,
      rawHtmlFileId: rawFileId,
      metadata: {
        model,
        importNote: track.note,
        publicDomainReason: parsed.publicDomainReason,
        minScore: MIN_PUBLIC_OVERALL_SCORE,
        seedId: track.id,
      },
    },
    workspaceId
  );

  if (!lyric?.id) return "skipped";

  await addEvidence(lyric.id, "source", "来源网址", track.sourceUrl, rawFileId, {
    model,
    publicDomainReason: parsed.publicDomainReason,
    overallScore: parsed.scores.overall,
    coverHotness: parsed.coverAnalysis.stars,
    includeReason: parsed.coverAnalysis.includeReason,
  });

  return "added";
}
