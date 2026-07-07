import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { icDataDir, writeJsonAtomic } from "../paths";
import { IC_DEFAULT_SETTINGS, type IcSettings } from "../types";

/** 情报中心设置（持久化 JSON）。打分/发现会实际读取它作为默认值。 */

function file(): string {
  return path.join(icDataDir(), "settings.json");
}

export function getSettings(): IcSettings {
  const f = file();
  if (!existsSync(f)) return { ...IC_DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(readFileSync(f, "utf8")) as Partial<IcSettings>;
    return { ...IC_DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...IC_DEFAULT_SETTINGS };
  }
}

export function updateSettings(patch: Partial<IcSettings>): IcSettings {
  const next: IcSettings = { ...getSettings(), ...patch };
  // 数值边界保护
  next.escalateMin = Math.max(0, Math.min(100, Math.round(next.escalateMin)));
  next.minScoreToRecommend = Math.max(0, Math.min(100, Math.round(next.minScoreToRecommend)));
  next.strongBudget = Math.max(0, Math.min(50, Math.round(next.strongBudget)));
  next.discoverPageSize = Math.max(1, Math.min(50, Math.round(next.discoverPageSize)));
  writeJsonAtomic(file(), next);
  return next;
}
