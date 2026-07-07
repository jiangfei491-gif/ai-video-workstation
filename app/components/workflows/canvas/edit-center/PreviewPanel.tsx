"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiPause,
  FiPlay,
  FiSkipBack,
  FiSkipForward,
} from "react-icons/fi";
import type { VoicePreviewSource } from "@/app/lib/auto-edit/timeline-preview";
import { resolveVoiceAtPlayhead } from "@/app/lib/auto-edit/timeline-preview";
import EditRenderProgressPanel from "@/app/components/workflows/canvas/EditRenderProgressPanel";

type Props = {
  finalEditVideoUrl: string | null;
  editRendering: boolean;
  renderProgress: { pct: number; message: string };
  playheadSec: number;
  durationSec: number;
  currentLabel: string | null;
  previewFrameUrl: string | null;
  /** 时间轴 scrub：当前镜头视频 */
  scrubVideoUrl?: string | null;
  scrubVideoOffsetSec?: number;
  /** 时间轴 scrub：配音轨 */
  voiceSources?: VoicePreviewSource[];
  /** 当前 playhead 字幕 */
  subtitleText?: string | null;
  bgmUrl?: string | null;
  bgmVolume?: number;
  duckUnderVoice?: boolean;
  duckAmount?: number;
  onSeek: (sec: number) => void;
  compact?: boolean;
  /** NLE 模式标题，默认「预览」 */
  playerTitle?: string;
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SubtitleOverlay({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-10 flex justify-center ${compact ? "bottom-2 px-2" : "bottom-8 px-6"}`}
    >
      <p
        className={`max-w-[92%] rounded-md bg-black/78 text-center font-medium leading-snug text-white shadow-lg ${
          compact ? "px-2 py-1 text-[11px]" : "px-4 py-2 text-sm"
        }`}
      >
        {text}
      </p>
    </div>
  );
}

export default function PreviewPanel({
  finalEditVideoUrl,
  editRendering,
  renderProgress,
  playheadSec,
  durationSec,
  currentLabel,
  previewFrameUrl,
  scrubVideoUrl = null,
  scrubVideoOffsetSec = 0,
  voiceSources = [],
  subtitleText = null,
  bgmUrl = null,
  bgmVolume = 0.25,
  duckUnderVoice = true,
  duckAmount = 0.55,
  onSeek,
  compact = false,
  playerTitle = "预览",
}: Props) {
  const finalVideoRef = useRef<HTMLVideoElement>(null);
  const scrubVideoRef = useRef<HTMLVideoElement>(null);
  const voiceAudioRef = useRef<HTMLAudioElement>(null);
  const bgmAudioRef = useRef<HTMLAudioElement>(null);
  const voiceSrcRef = useRef<string | null>(null);
  const bgmSrcRef = useRef<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [finalDurationSec, setFinalDurationSec] = useState(0);
  const scrubbingRef = useRef(false);
  const playheadRef = useRef(playheadSec);

  const hasFinalVideo = Boolean(finalEditVideoUrl);
  const effectiveDurationSec =
    hasFinalVideo && finalDurationSec > 0 ? finalDurationSec : durationSec;
  const hasScrubVisual = Boolean(scrubVideoUrl || previewFrameUrl);
  const hasVoicePreview = voiceSources.length > 0;

  useEffect(() => {
    playheadRef.current = playheadSec;
  }, [playheadSec]);

  useEffect(() => {
    setPlaying(false);
    setVideoError(null);
    setFinalDurationSec(0);
  }, [finalEditVideoUrl]);

  useEffect(() => {
    const v = finalVideoRef.current;
    if (!v || !hasFinalVideo || scrubbingRef.current) return;
    if (Math.abs(v.currentTime - playheadSec) > 0.35) {
      v.currentTime = playheadSec;
    }
  }, [playheadSec, hasFinalVideo]);

  useEffect(() => {
    const v = scrubVideoRef.current;
    if (!v || hasFinalVideo || !scrubVideoUrl || scrubbingRef.current) return;
    if (Math.abs(v.currentTime - scrubVideoOffsetSec) > 0.2) {
      v.currentTime = scrubVideoOffsetSec;
    }
  }, [scrubVideoUrl, scrubVideoOffsetSec, hasFinalVideo]);

  const pauseScrubAudio = useCallback(() => {
    voiceAudioRef.current?.pause();
    bgmAudioRef.current?.pause();
    scrubVideoRef.current?.pause();
  }, []);

  const togglePlay = useCallback(async () => {
    const v = finalVideoRef.current;
    if (hasFinalVideo && v) {
      if (v.paused) {
        await v.play();
        setPlaying(true);
      } else {
        v.pause();
        setPlaying(false);
      }
      return;
    }

    if (playing) {
      pauseScrubAudio();
      setPlaying(false);
      return;
    }

    setPlaying(true);
    if (scrubVideoUrl) {
      const sv = scrubVideoRef.current;
      if (sv) {
        sv.currentTime = scrubVideoOffsetSec;
        void sv.play().catch(() => {});
      }
    }
  }, [hasFinalVideo, playing, pauseScrubAudio, scrubVideoUrl, scrubVideoOffsetSec]);

  useEffect(() => {
    if (hasFinalVideo || !playing) {
      if (!hasFinalVideo) pauseScrubAudio();
      return;
    }

    const id = setInterval(() => {
      const next = Math.min(effectiveDurationSec, playheadRef.current + 0.05);
      playheadRef.current = next;
      onSeek(next);
      if (next >= effectiveDurationSec - 0.01) {
        setPlaying(false);
        pauseScrubAudio();
      }
    }, 50);

    return () => clearInterval(id);
  }, [hasFinalVideo, playing, effectiveDurationSec, onSeek, pauseScrubAudio]);

  useEffect(() => {
    if (hasFinalVideo || !playing) return;

    const activeVoice = resolveVoiceAtPlayhead(voiceSources, playheadSec);
    const voiceEl = voiceAudioRef.current;
    if (!activeVoice || !voiceEl) {
      voiceEl?.pause();
      return;
    }

    if (voiceSrcRef.current !== activeVoice.url) {
      voiceEl.src = activeVoice.url;
      voiceSrcRef.current = activeVoice.url;
    }
    if (Math.abs(voiceEl.currentTime - activeVoice.offsetSec) > 0.2) {
      voiceEl.currentTime = activeVoice.offsetSec;
    }
    if (voiceEl.paused) {
      void voiceEl.play().catch(() => {});
    }
  }, [hasFinalVideo, playing, playheadSec, voiceSources]);

  useEffect(() => {
    if (hasFinalVideo || !playing || !bgmUrl) {
      bgmAudioRef.current?.pause();
      return;
    }
    const bgm = bgmAudioRef.current;
    if (!bgm) return;
    if (bgmSrcRef.current !== bgmUrl) {
      bgm.src = bgmUrl;
      bgmSrcRef.current = bgmUrl;
    }
    const activeVoice = resolveVoiceAtPlayhead(voiceSources, playheadSec);
    const duckMul =
      duckUnderVoice && activeVoice
        ? Math.max(0.15, 1 - duckAmount)
        : 1;
    bgm.volume = Math.max(0, Math.min(1, bgmVolume * duckMul));
    bgm.loop = true;
    if (bgm.paused) void bgm.play().catch(() => {});
  }, [hasFinalVideo, playing, bgmUrl, bgmVolume, duckUnderVoice, duckAmount, playheadSec, voiceSources]);

  useEffect(() => {
    if (playing && scrubVideoUrl && !hasFinalVideo) {
      const sv = scrubVideoRef.current;
      if (sv && sv.paused) {
        sv.currentTime = scrubVideoOffsetSec;
        void sv.play().catch(() => {});
      }
    }
  }, [playing, scrubVideoUrl, scrubVideoOffsetSec, hasFinalVideo]);

  const onFinalVideoTimeUpdate = () => {
    const v = finalVideoRef.current;
    if (!v || scrubbingRef.current) return;
    onSeek(v.currentTime);
  };

  const step = (delta: number) => {
    onSeek(Math.max(0, Math.min(effectiveDurationSec, playheadSec + delta)));
  };

  const showSubtitle = Boolean(subtitleText?.trim()) && !hasFinalVideo;

  return (
    <div
      className={`edit-preview flex min-h-0 flex-col bg-[var(--bg-inset)] ${compact ? "h-auto" : "h-full"}`}
    >
      <audio ref={voiceAudioRef} className="hidden" preload="auto" />
      <audio ref={bgmAudioRef} className="hidden" preload="auto" />

      {!compact && (
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{playerTitle}</p>
            {currentLabel && (
              <p className="truncate text-xs text-[var(--text-caption)]">{currentLabel}</p>
            )}
            {!hasFinalVideo && hasVoicePreview && (
              <p className="text-[10px] text-[var(--text-caption)]">
                播放时将同步配音{showSubtitle ? "与字幕" : ""}
                {bgmUrl ? " · BGM" : ""}
              </p>
            )}
          </div>
          <span className="font-mono text-xs tabular-nums text-[var(--text-caption)]">
            {formatTime(playheadSec)} / {formatTime(effectiveDurationSec)}
          </span>
        </div>
      )}

      <div
        className={`relative flex items-center justify-center ${compact ? "p-2" : "min-h-0 flex-1 p-4"}`}
      >
        {editRendering ? (
          <div className="w-full">
            <EditRenderProgressPanel progress={renderProgress.pct} message={renderProgress.message} />
          </div>
        ) : hasFinalVideo ? (
          <div className="relative w-full">
            <video
              ref={finalVideoRef}
              key={finalEditVideoUrl!}
              src={finalEditVideoUrl!}
              preload="metadata"
              playsInline
              controls
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && d > 0) setFinalDurationSec(d);
              }}
              onTimeUpdate={onFinalVideoTimeUpdate}
              onEnded={() => setPlaying(false)}
              onError={() =>
                setVideoError("无法在线预览（文件元数据可能在末尾），请点下方下载或重新导出")
              }
              onClick={() => void togglePlay()}
              className="mx-auto w-full cursor-pointer rounded-lg bg-black object-contain shadow ring-1 ring-[var(--border-strong)]"
              style={{ maxHeight: compact ? 140 : "calc(100vh - 420px)" }}
            />
            {videoError && (
              <p className="mt-1 text-center text-xs text-[var(--danger)]">{videoError}</p>
            )}
          </div>
        ) : scrubVideoUrl ? (
          <div className="relative w-full">
            <video
              ref={scrubVideoRef}
              key={scrubVideoUrl}
              src={scrubVideoUrl}
              muted
              playsInline
              preload="metadata"
              className="mx-auto w-full rounded-lg bg-black object-contain ring-1 ring-[var(--border-strong)]"
              style={{ maxHeight: compact ? 140 : "calc(100vh - 420px)" }}
            />
            {showSubtitle && subtitleText && (
              <SubtitleOverlay text={subtitleText} compact={compact} />
            )}
          </div>
        ) : previewFrameUrl ? (
          <div className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewFrameUrl}
              alt=""
              className="mx-auto w-full rounded-lg object-contain ring-1 ring-[var(--border-strong)]"
              style={{ maxHeight: compact ? 140 : "calc(100vh - 420px)" }}
            />
            {showSubtitle && subtitleText && (
              <SubtitleOverlay text={subtitleText} compact={compact} />
            )}
            {!compact && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-lg bg-gradient-to-t from-black/50 to-transparent px-4 py-3">
                <p className="text-xs text-white/90">
                  点击播放试听配音{showSubtitle ? " · 字幕随时间轴显示" : ""}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div
            className="relative flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-caption)]"
            style={{
              aspectRatio: compact ? "16/9" : "9/16",
              maxHeight: compact ? 100 : "calc(100vh - 420px)",
              maxWidth: compact ? "100%" : "280px",
            }}
          >
            <p className={compact ? "text-xs" : "text-sm font-medium"}>暂无画面</p>
            {!compact && (
              <p className="mt-1 px-6 text-center text-xs">生成首帧或视频后，此处显示当前镜头</p>
            )}
            {showSubtitle && subtitleText && (
              <SubtitleOverlay text={subtitleText} compact={compact} />
            )}
          </div>
        )}
      </div>

      <div
        className={`edit-transport shrink-0 border-t border-[var(--border-strong)] bg-[var(--bg-surface)] ${compact ? "px-2 py-2" : "px-4 py-3"}`}
      >
        <div className={`mx-auto flex items-center gap-2 ${compact ? "" : "max-w-3xl gap-3"}`}>
          {!compact && (
            <button
              type="button"
              onClick={() => step(-1)}
              className="edit-transport-btn"
              title="后退 1 秒"
            >
              <FiSkipBack className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void togglePlay()}
            className={`edit-transport-btn ${compact ? "h-8 w-8" : ""} edit-transport-btn-primary`}
            title={playing ? "暂停" : "播放"}
          >
            {playing ? <FiPause className="h-3.5 w-3.5" /> : <FiPlay className="h-3.5 w-3.5" />}
          </button>
          {!compact && (
            <button
              type="button"
              onClick={() => step(1)}
              className="edit-transport-btn"
              title="前进 1 秒"
            >
              <FiSkipForward className="h-4 w-4" />
            </button>
          )}
          <input
            type="range"
            min={0}
            max={Math.max(0.1, effectiveDurationSec)}
            step={0.05}
            value={playheadSec}
            onPointerDown={() => {
              scrubbingRef.current = true;
              if (!hasFinalVideo) {
                setPlaying(false);
                pauseScrubAudio();
              }
            }}
            onPointerUp={() => {
              scrubbingRef.current = false;
            }}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="edit-range min-w-0 flex-1"
          />
          {compact && (
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--text-caption)]">
              {formatTime(playheadSec)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
