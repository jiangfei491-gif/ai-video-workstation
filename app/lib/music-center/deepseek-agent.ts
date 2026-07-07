import OpenAI from "openai";
import { recordTokenCost } from "@/app/lib/cost-ledger/unified";
import { recommendBgmByRules } from "@/app/lib/auto-edit/engines/music-engine/recommend";
import { bgmDirHint } from "@/app/lib/storage/workspace-paths";
import { listBgmLibrary } from "./bgm-library";
import type { MusicDirectorTask, MusicPlan, MusicStyleTemplate } from "./types";
import { buildDefaultVolumeStrategy } from "./engines/ducking";

function readEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function isDeepSeekAvailable(): boolean {
  return Boolean(readEnv("DEEPSEEK_API_KEY"));
}

const STYLE_LABELS: Record<MusicStyleTemplate, string> = {
  documentary: "纪录片",
  viral: "短视频爆款",
  cinematic: "电影感",
  ambient: "氛围",
  epic: "史诗",
  lofi: "Lo-Fi",
  custom: "自定义",
};

export function listMusicStyleTemplates(): { id: MusicStyleTemplate; label: string }[] {
  return (Object.keys(STYLE_LABELS) as MusicStyleTemplate[])
    .filter((id) => id !== "custom")
    .map((id) => ({ id, label: STYLE_LABELS[id] }));
}

/** 规则回退（无 DeepSeek 或用户关闭 AI 推荐） */
export function recommendMusicPlanFallback(task: MusicDirectorTask): MusicPlan {
  const pacing = task.pacingProfile ?? "documentary";
  const rec = recommendBgmByRules({
    pacingProfile: pacing,
    durationSec: task.durationSec,
    topic: task.topic,
  });

  const library = listBgmLibrary();
  const pick =
    (task.bgmFilename && library.find((e) => e.filename === task.bgmFilename)) ||
    (task.bgmUrl && library.find((e) => e.url === task.bgmUrl)) ||
    (rec && library.find((e) => e.filename === rec.filename)) ||
    library[0];

  if (!pick) {
    throw new Error(`BGM 库为空，请将 mp3/wav 放入 ${bgmDirHint()}/`);
  }

  const volumeStrategy = buildDefaultVolumeStrategy(task);

  return {
    bgmFilename: pick.filename,
    bgmUrl: pick.url,
    bgmLabel: pick.filename,
    style: (task.template ?? pacing) as MusicStyleTemplate,
    rationale: rec ? [rec.rationale] : [`规则回退：按「${STYLE_LABELS[pacing as MusicStyleTemplate] ?? pacing}」节奏选曲`],
    bpm: task.bpm,
    volumeStrategy,
    sfxSuggestions: [],
    climaxPoints: [],
    beatMarkers: [],
  };
}

/**
 * DeepSeek Music Agent — 推荐 BGM / 音效 / 风格 / 高潮点 / 卡点 / 音量策略
 */
export async function runDeepSeekMusicPlan(
  task: MusicDirectorTask
): Promise<{ plan: MusicPlan; cost: number }> {
  const apiKey = readEnv("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return { plan: recommendMusicPlanFallback(task), cost: 0 };
  }

  const library = listBgmLibrary();
  if (library.length === 0) {
    throw new Error(`BGM 库为空，请将 mp3/wav 放入 ${bgmDirHint()}/`);
  }

  const model = readEnv("DEEPSEEK_MODEL") ?? "deepseek-chat";
  const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });

  const payload = {
    durationSec: task.durationSec,
    pacingProfile: task.pacingProfile ?? "documentary",
    topic: task.topic ?? "",
    scriptExcerpt: (task.script ?? "").slice(0, 2000),
    bpmHint: task.bpm,
    voiceSegments: task.voiceClips ?? [],
    videoSegments: task.videoClips ?? [],
    availableBgm: library.map((e) => e.filename),
    templates: listMusicStyleTemplates().map((t) => t.id),
  };

  const system = `你是 AI Cut 音乐中心 DeepSeek Music Agent。只输出 JSON，不要 markdown。
职责：从 availableBgm 中选一首 BGM，推荐音乐风格、高潮点、卡点位置、音量策略、可选音效建议。
约束：bgmFilename 必须来自 availableBgm；时间戳不得超过 durationSec。
输出格式：
{
  "bgmFilename": "",
  "style": "documentary|viral|cinematic|ambient|epic|lofi",
  "bpm": 120,
  "rationale": ["推荐理由"],
  "climaxPoints": [{ "sec": 0, "label": "高潮描述" }],
  "beatMarkers": [{ "sec": 0, "strength": 0.8 }],
  "volumeStrategy": {
    "baseVolume": 0.25,
    "duckUnderVoice": true,
    "duckAmount": 0.12,
    "fadeInSec": 1.5,
    "fadeOutSec": 2
  },
  "sfxSuggestions": [{ "label": "音效名", "atSec": 0, "rationale": "原因" }]
}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload) },
    ],
    temperature: 0.35,
    max_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { plan: recommendMusicPlanFallback(task), cost: 0 };
  }

  const filename = String(parsed.bgmFilename ?? "").trim();
  const entry =
    library.find((e) => e.filename === filename) ??
    library.find((e) => e.filename.toLowerCase() === filename.toLowerCase()) ??
    library[0]!;

  const vs = (parsed.volumeStrategy ?? {}) as Record<string, unknown>;
  const baseStrategy = buildDefaultVolumeStrategy(task);
  const volumeStrategy = {
    ...baseStrategy,
    baseVolume: Number(vs.baseVolume) || baseStrategy.baseVolume,
    duckUnderVoice: vs.duckUnderVoice !== false,
    duckAmount: Number(vs.duckAmount) || baseStrategy.duckAmount,
    fadeInSec: Number(vs.fadeInSec) || baseStrategy.fadeInSec,
    fadeOutSec: Number(vs.fadeOutSec) || baseStrategy.fadeOutSec,
  };

  const styleRaw = String(parsed.style ?? task.template ?? task.pacingProfile ?? "documentary");
  const style = (
    listMusicStyleTemplates().some((t) => t.id === styleRaw) ? styleRaw : "documentary"
  ) as MusicStyleTemplate;

  const plan: MusicPlan = {
    bgmFilename: entry.filename,
    bgmUrl: entry.url,
    bgmLabel: entry.filename,
    style,
    rationale: Array.isArray(parsed.rationale)
      ? parsed.rationale.map(String)
      : ["DeepSeek 推荐"],
    bpm: Number(parsed.bpm) || task.bpm,
    climaxPoints: Array.isArray(parsed.climaxPoints)
      ? parsed.climaxPoints.map((c) => {
          const row = c as Record<string, unknown>;
          return { sec: Number(row.sec) || 0, label: String(row.label ?? "") };
        })
      : [],
    beatMarkers: Array.isArray(parsed.beatMarkers)
      ? parsed.beatMarkers.map((b) => {
          const row = b as Record<string, unknown>;
          return { sec: Number(row.sec) || 0, strength: Number(row.strength) || 0.5 };
        })
      : [],
    volumeStrategy,
    sfxSuggestions: Array.isArray(parsed.sfxSuggestions)
      ? parsed.sfxSuggestions.map((s) => {
          const row = s as Record<string, unknown>;
          return {
            label: String(row.label ?? ""),
            atSec: Number(row.atSec) || 0,
            rationale: String(row.rationale ?? ""),
          };
        })
      : [],
  };

  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;
  const cost = (inputTokens * 0.28 + outputTokens * 0.42) / 1_000_000;
  recordTokenCost("音乐中心", "配乐分析", "deepseek", "deepseek-chat", inputTokens, outputTokens);

  return { plan, cost };
}

export { STYLE_LABELS };
