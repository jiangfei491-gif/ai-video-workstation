import fs from "fs";
import path from "path";
import {
  DESKTOP_VEO_DIRS,
  ensureDesktopVeoLayout,
  toDesktopFileUrl,
} from "@/app/lib/storage/desktop-veo";
import type { PacingProfile } from "../../types";

export type BgmRecommendation = {
  url: string;
  label: string;
  rationale: string;
  filename: string;
};

const MOOD_KEYWORDS: Record<PacingProfile, string[]> = {
  documentary: ["calm", "ambient", "soft", "documentary", "纪录", "舒缓", "叙事", "plain"],
  viral: ["upbeat", "energetic", "fast", "viral", "燃", "节奏", "短视频", "pop", "happy"],
  cinematic: ["cinematic", "epic", "orchestral", "电影", "史诗", "大气", "dramatic", "trailer"],
};

const AUDIO_EXT = /\.(mp3|wav|m4a|aac|flac|ogg)$/i;

export function listLocalBgmFiles(): { filename: string; url: string }[] {
  ensureDesktopVeoLayout();
  if (!fs.existsSync(DESKTOP_VEO_DIRS.bgm)) return [];

  return fs
    .readdirSync(DESKTOP_VEO_DIRS.bgm)
    .filter((name) => AUDIO_EXT.test(name))
    .map((filename) => ({
      filename,
      url: toDesktopFileUrl(path.join("BGM", filename)),
    }));
}

/** 规则推荐：按 pacing + 文件名关键词从 Workspace BGM 库选曲 */
export function recommendBgmByRules(params: {
  pacingProfile: PacingProfile;
  durationSec: number;
  topic?: string;
}): BgmRecommendation | null {
  const files = listLocalBgmFiles();
  if (files.length === 0) return null;

  const keywords = MOOD_KEYWORDS[params.pacingProfile] ?? MOOD_KEYWORDS.documentary;
  const topicWords = (params.topic ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const scored = files.map((file) => {
    const name = file.filename.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (name.includes(kw.toLowerCase())) score += 2;
    }
    for (const tw of topicWords) {
      if (name.includes(tw)) score += 1;
    }
    return { ...file, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const pick = scored.find((f) => f.score > 0) ?? scored[0];

  const pacingLabel =
    params.pacingProfile === "viral"
      ? "短视频"
      : params.pacingProfile === "cinematic"
        ? "电影感"
        : "纪录片";

  return {
    url: pick.url,
    label: pick.filename,
    filename: pick.filename,
    rationale:
      pick.score > 0
        ? `按「${pacingLabel}」节奏与文件名关键词匹配：${pick.filename}`
        : `BGM 文件夹中无更优匹配，已选用：${pick.filename}`,
  };
}
