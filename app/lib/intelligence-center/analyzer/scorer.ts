import type { IcDiscoveredItem } from "../types";
import { getModuleNames, platformStateText } from "../platform-profile";
import { IC_MODELS, costUsd, stripFence, type IcModelId } from "./models";
import { recordTokenCost } from "@/app/lib/cost-ledger/unified";

/**
 * 成本感知级联打分：
 *  1) 本地关键词预筛（免费）——明显无关的项不送模型
 *  2) 便宜模型批量打分（DeepSeek / Gemini Flash）
 *  3) 强模型只复核高分/临界项（Claude Sonnet），带预算上限
 */

export interface IcScoredItem {
  item: IcDiscoveredItem;
  localRelevance: number; // 0..1
  score: number; // 0..100
  module: string; // 最匹配的工作台模块，或「无」
  worth: boolean; // 是否值得接入
  tags: string[];
  reason: string;
  advice: string; // 接入建议：接到哪个模块、怎么用/替换或补充什么
  scoredBy: IcModelId | "local";
  escalated: boolean;
}

export interface IcModelUsageStat {
  model: IcModelId;
  inTok: number;
  outTok: number;
  calls: number;
  costUsd: number;
}

export interface IcScoreRun {
  items: IcScoredItem[];
  costUsd: number;
  usage: IcModelUsageStat[];
  cheapModel: IcModelId;
  strongModel?: IcModelId;
  note?: string;
}

export interface IcScoreOptions {
  cheapModel?: IcModelId;
  strongModel?: IcModelId;
  useStrong?: boolean;
  escalateMin?: number; // 便宜档达到多少分才送强模型复核
  strongBudget?: number; // 本次最多复核多少项
  batchSize?: number; // 便宜档每批多少项
  localFloor?: number; // 本地相关度低于此值的项跳过模型（0=全送）
}

// AI 视频工作台相关领域关键词（本地预筛用）
const DOMAIN_KEYWORDS = [
  "video", "text-to-video", "image-to-video", "t2v", "i2v", "video generation", "video-generation",
  "diffusion", "veo", "sora", "wan", "hunyuan", "cogvideo", "animatediff", "svd", "ltx", "mochi",
  "lora", "comfyui", "controlnet", "ipadapter", "upscal", "interpolat", "rife", "frame",
  "tts", "text-to-speech", "voice", "speech", "audio", "music", "sound", "lip", "talking head",
  "avatar", "portrait", "motion", "animation", "3d", "gaussian", "nerf", "pose",
  "image generation", "flux", "stable diffusion", "sdxl", "inpaint", "matting", "segmentation",
  "background removal", "subtitle", "whisper", "caption", "asr", "editing", "ffmpeg",
  "mcp", "agent", "prompt", "多模态", "multimodal", "视频", "生成", "配音", "字幕", "特效", "剪辑",
];

function localRelevance(item: IcDiscoveredItem): number {
  const hay = `${item.title} ${item.summary ?? ""} ${JSON.stringify(item.metadata ?? {})}`.toLowerCase();
  let hits = 0;
  for (const kw of DOMAIN_KEYWORDS) if (hay.includes(kw)) hits++;
  return Math.min(1, hits * 0.25);
}

function compactItem(item: IcDiscoveredItem) {
  const m = item.metadata ?? {};
  const meta: Record<string, unknown> = {};
  for (const k of ["stars", "downloads", "likes", "pipeline_tag", "language", "tasks", "topics", "version"]) {
    if (m[k] != null) meta[k] = m[k];
  }
  return {
    id: item.id,
    platform: item.platformId,
    title: item.title,
    summary: (item.summary ?? "").slice(0, 400),
    meta,
  };
}

function systemPrompt(): string {
  return [
    "你是「AI 视频工作台」的技术侦察官。",
    platformStateText(),
    "给你一批从各平台发现的 AI 新技术/项目，请逐个评估它对本工作台的价值。",
    "评分标准（0-100）：与上述模块能力的相关度、成熟度与活跃度（star/下载/likes）、可落地性、是否填补现有能力空白。",
    "重要：若该项目的功能与「已集成技术栈」重复（工作台已经能做），分数要明显降低；只有能填补空白、或明显强于现有方案的，才给高分。",
    `module 只能填以下之一或「无」：${getModuleNames().join("、")}。`,
    "对每一项给出：score(0-100 整数)、module、worth(true/false 是否值得接入)、tags(2-5 个中文标签)、reason(≤30 字中文，为何这个分)、advice(≤40 字中文：具体建议接到哪个模块、怎么用——替换/补充什么能力；不值得则写“暂不建议”)。",
    "只输出 JSON：{\"results\":[{\"id\":\"...\",\"score\":0,\"module\":\"...\",\"worth\":false,\"tags\":[],\"reason\":\"...\",\"advice\":\"...\"}]}。id 必须原样返回。",
  ].join("");
}

type RawResult = { id: string; score: number; module: string; worth: boolean; tags: string[]; reason: string; advice: string };

function parseResults(text: string): Map<string, RawResult> {
  const map = new Map<string, RawResult>();
  try {
    const parsed = JSON.parse(stripFence(text));
    const arr: RawResult[] = Array.isArray(parsed) ? parsed : parsed.results ?? [];
    for (const r of arr) {
      if (!r || typeof r.id !== "string") continue;
      map.set(r.id, {
        id: r.id,
        score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
        module: typeof r.module === "string" ? r.module : "无",
        worth: Boolean(r.worth),
        tags: Array.isArray(r.tags) ? r.tags.map(String).slice(0, 5) : [],
        reason: typeof r.reason === "string" ? r.reason.slice(0, 60) : "",
        advice: typeof r.advice === "string" ? r.advice.slice(0, 80) : "",
      });
    }
  } catch {
    /* 解析失败 → 空 map，调用方兜底 */
  }
  return map;
}

async function scoreBatch(
  modelId: IcModelId,
  items: IcDiscoveredItem[],
): Promise<{ results: Map<string, RawResult>; inTok: number; outTok: number }> {
  const model = IC_MODELS[modelId];
  const user = `待评估项目（JSON）：\n${JSON.stringify(items.map(compactItem))}`;
  const { text, inTok, outTok } = await model.call(systemPrompt(), user);
  return { results: parseResults(text), inTok, outTok };
}

function localScored(item: IcDiscoveredItem, rel: number): IcScoredItem {
  return {
    item,
    localRelevance: rel,
    score: Math.round(rel * 60),
    module: "无",
    worth: false,
    tags: [],
    reason: rel === 0 ? "本地判定无关" : "本地初筛，未送模型",
    advice: "",
    scoredBy: "local",
    escalated: false,
  };
}

export async function scoreItems(
  items: IcDiscoveredItem[],
  opts: IcScoreOptions = {},
): Promise<IcScoreRun> {
  const cheapModel: IcModelId =
    opts.cheapModel && IC_MODELS[opts.cheapModel].available()
      ? opts.cheapModel
      : IC_MODELS.deepseek.available()
        ? "deepseek"
        : "gemini-flash";
  const strongModel: IcModelId = opts.strongModel ?? "claude-sonnet";
  const useStrong = (opts.useStrong ?? true) && IC_MODELS[strongModel].available();
  const escalateMin = opts.escalateMin ?? 60;
  const strongBudget = opts.strongBudget ?? 8;
  const batchSize = opts.batchSize ?? 12;
  const localFloor = opts.localFloor ?? 0;

  const usage = new Map<IcModelId, IcModelUsageStat>();
  const track = (m: IcModelId, inTok: number, outTok: number) => {
    const cur = usage.get(m) ?? { model: m, inTok: 0, outTok: 0, calls: 0, costUsd: 0 };
    cur.inTok += inTok;
    cur.outTok += outTok;
    cur.calls += 1;
    cur.costUsd = costUsd(IC_MODELS[m], cur.inTok, cur.outTok);
    usage.set(m, cur);
  };

  if (!IC_MODELS[cheapModel].available()) {
    return {
      items: items.map((it) => localScored(it, localRelevance(it))),
      costUsd: 0,
      usage: [],
      cheapModel,
      note: "未配置便宜档模型 key，仅本地打分",
    };
  }

  // 1) 本地预筛
  const rel = new Map(items.map((it) => [it.id, localRelevance(it)] as const));
  const scored = new Map<string, IcScoredItem>();
  const candidates: IcDiscoveredItem[] = [];
  for (const it of items) {
    const r = rel.get(it.id)!;
    if (r < localFloor) scored.set(it.id, localScored(it, r));
    else candidates.push(it);
  }

  // 2) 便宜档批量打分
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    try {
      const { results, inTok, outTok } = await scoreBatch(cheapModel, batch);
      track(cheapModel, inTok, outTok);
      for (const it of batch) {
        const r = results.get(it.id);
        scored.set(
          it.id,
          r
            ? {
                item: it,
                localRelevance: rel.get(it.id)!,
                score: r.score,
                module: r.module,
                worth: r.worth,
                tags: r.tags,
                reason: r.reason,
                advice: r.advice,
                scoredBy: cheapModel,
                escalated: false,
              }
            : localScored(it, rel.get(it.id)!),
        );
      }
    } catch {
      for (const it of batch) scored.set(it.id, localScored(it, rel.get(it.id)!));
    }
  }

  // 3) 强模型复核高分/临界项
  if (useStrong) {
    const escalate = candidates
      .map((it) => scored.get(it.id)!)
      .filter((s) => s.scoredBy === cheapModel && s.score >= escalateMin)
      .sort((a, b) => b.score - a.score)
      .slice(0, strongBudget)
      .map((s) => s.item);
    if (escalate.length) {
      try {
        const { results, inTok, outTok } = await scoreBatch(strongModel, escalate);
        track(strongModel, inTok, outTok);
        for (const it of escalate) {
          const r = results.get(it.id);
          if (r) {
            scored.set(it.id, {
              item: it,
              localRelevance: rel.get(it.id)!,
              score: r.score,
              module: r.module,
              worth: r.worth,
              tags: r.tags,
              reason: r.reason,
              advice: r.advice,
              scoredBy: strongModel,
              escalated: true,
            });
          }
        }
      } catch {
        /* 复核失败 → 保留便宜档结果 */
      }
    }
  }

  const usageArr = [...usage.values()];
  // 记入全平台成本总账
  for (const u of usageArr) {
    recordTokenCost("情报中心", "AI 打分", u.model, u.model, u.inTok, u.outTok, { costUsd: u.costUsd });
  }
  const out = items
    .map((it) => scored.get(it.id)!)
    .sort((a, b) => b.score - a.score);
  return {
    items: out,
    costUsd: usageArr.reduce((s, u) => s + u.costUsd, 0),
    usage: usageArr,
    cheapModel,
    strongModel: useStrong ? strongModel : undefined,
  };
}
