import fs from "fs";
import path from "path";

import {
  desktopAudioPath,
  ensureDesktopVeoLayout,
  toDesktopFileUrl,
} from "@/app/lib/storage/desktop-veo";
import { probeMediaDurationSec } from "./probe-duration";

/** 复用磁盘上已生成的配音（避免渲染时重复 TTS） */
export function findExistingVoiceOnDisk(shotIndex: number): {
  filepath: string;
  url: string;
  durationSec: number;
  relativePath: string;
} | null {
  ensureDesktopVeoLayout();
  const dir = path.dirname(desktopAudioPath("probe.mp3"));
  if (!fs.existsSync(dir)) return null;

  const preferred = [
    `voice-shot-${shotIndex}-auto.mp3`,
    `voice-shot-${shotIndex}.mp3`,
    `voice-shot-${shotIndex}-edge-tts.mp3`,
    `voice-shot-${shotIndex}-elevenlabs.mp3`,
  ];

  for (const name of preferred) {
    const filepath = path.join(dir, name);
    if (!fs.existsSync(filepath) || fs.statSync(filepath).size < 256) continue;
    const relativePath = path.join("Audio", name);
    return {
      filepath,
      url: toDesktopFileUrl(relativePath),
      durationSec: probeMediaDurationSec(filepath),
      relativePath,
    };
  }

  const prefix = `voice-shot-${shotIndex}-`;
  const matches = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".mp3"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const latest = matches[0];
  if (!latest) return null;
  const filepath = path.join(dir, latest.name);
  if (fs.statSync(filepath).size < 256) return null;
  const relativePath = path.join("Audio", latest.name);
  return {
    filepath,
    url: toDesktopFileUrl(relativePath),
    durationSec: probeMediaDurationSec(filepath),
    relativePath,
  };
}
