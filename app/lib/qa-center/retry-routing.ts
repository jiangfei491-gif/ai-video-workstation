import type { ModuleId } from "@/app/lib/platform/module-registry";
import type { QaIssue, QaRetryTarget, QaScoreBreakdown } from "./types";

const MODULE_LINKS: Partial<Record<ModuleId, { label: string; href: string }>> = {
  "video-creation-media": { label: "创作中心（补镜/画面）", href: "/ai-video" },
  "voice-center": { label: "配音中心", href: "/voice-center" },
  "subtitle-center": { label: "字幕中心", href: "/subtitle-center" },
  "music-center": { label: "音乐中心", href: "/music-center" },
  "effect-center": { label: "特效中心", href: "/effect-center" },
  opencut: { label: "OpenCut（重导出）", href: "/ai-edit" },
  "ai-director": { label: "AI 导演（Patch Plan）", href: "/canvas" },
  "clip-agent": { label: "剪辑 Agent", href: "/ai-edit" },
};

function target(
  module: QaRetryTarget["module"],
  action: string,
  reason: string,
  autoFixable?: boolean
): QaRetryTarget {
  const meta = MODULE_LINKS[module as keyof typeof MODULE_LINKS];
  const fixable =
    autoFixable ??
    (module === "voice-center" ||
      module === "subtitle-center" ||
      module === "music-center" ||
      module === "effect-center");
  return {
    module,
    label: meta?.label ?? module,
    href: meta?.href ?? "/canvas",
    action,
    reason,
    autoFixable: fixable,
  };
}

/** 根据问题定位「建议回流环节」（需用户拍板后才会自动执行） */
export function buildRetryTargets(
  issues: QaIssue[],
  score: QaScoreBreakdown,
  threshold: number
): QaRetryTarget[] {
  const out: QaRetryTarget[] = [];
  const seen = new Set<string>();

  const push = (t: QaRetryTarget) => {
    const key = `${t.module}:${t.action}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  if (issues.some((i) => i.code === "empty_shot" || i.code === "no_video")) {
    push(target("video-creation-media", "补镜/重生成画面", "存在空镜头或缺媒体"));
  }
  if (issues.some((i) => i.code === "shot_too_long" || i.code === "shot_too_short")) {
    push(target("ai-director", "patch_plan_shot_duration", "镜长策略需调整"));
  }
  if (issues.some((i) => i.code.startsWith("subtitle"))) {
    push(target("subtitle-center", "rebuild_subtitles", "字幕轨需优化"));
  }
  if (issues.some((i) => i.code === "subtitle_no_voice")) {
    push(target("voice-center", "resynthesize_voice", "配音与字幕不同步"));
  }
  if (issues.some((i) => i.code === "no_bgm")) {
    push(target("music-center", "reapply_bgm", "需挂载或更换 BGM"));
  }
  if (
    issues.some(
      (i) =>
        i.code.includes("audio") ||
        i.code === "no_audio_stream" ||
        i.code.includes("bgm")
    )
  ) {
    push(target("music-center", "adjust_volume", "音量或音频轨需调整"));
  }
  if (
    issues.some(
      (i) =>
        i.code.includes("black") ||
        i.code.includes("gap") ||
        i.code.includes("overlap") ||
        i.code.includes("timeline")
    )
  ) {
    push(target("effect-center", "reapply_transitions", "转场或时间轴需修正"));
  }
  if (issues.some((i) => i.code === "low_resolution" || i.code === "no_video_stream")) {
    push(target("opencut", "reexport", "导出参数或成片需重渲染"));
  }

  if (score.subtitles != null && score.subtitles < threshold) {
    push(target("subtitle-center", "rebuild_subtitles", `字幕分项 ${score.subtitles} 偏低`));
  }
  if (score.music != null && score.music < threshold) {
    push(target("music-center", "reapply_bgm", `音乐分项 ${score.music} 偏低`));
  }
  if (score.effects != null && score.effects < threshold) {
    push(target("effect-center", "reapply_effects", `特效分项 ${score.effects} 偏低`));
  }
  if (score.shots != null && score.shots < threshold) {
    push(target("video-creation-media", "regenerate_shots", `镜头分项 ${score.shots} 偏低`));
  }
  if (score.rhythm != null && score.rhythm < threshold) {
    push(target("ai-director", "patch_plan_pacing", `节奏分项 ${score.rhythm} 偏低`));
  }

  return out;
}
