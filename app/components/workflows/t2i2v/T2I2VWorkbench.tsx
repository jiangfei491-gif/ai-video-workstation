"use client";

import { useState } from "react";
import GenerationModeToggle from "@/app/components/workflows/shared/GenerationModeToggle";
import ShotLockPanel from "@/app/components/workflows/shared/ShotLockPanel";
import WorkspaceModeToggle from "@/app/components/workflows/shared/WorkspaceModeToggle";
import type { ShotLockRecord } from "@/app/lib/shot-lock";
import type { GenerationMode } from "@/app/lib/generation-mode";
import { DEFAULT_PRODUCTION_DURATION_SEC } from "@/app/lib/generation-mode";
import type { WorkspaceMode } from "@/app/lib/workspace-mode";

const VEO_MODEL = "veo-3.1-generate-preview";

type ImageResult = {
  id: string;
  publicUrl: string;
  previewUrl?: string;
  model: string;
};

function toBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

export default function T2I2VWorkbench() {
  const [topic, setTopic] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("preview");
  const [mode, setMode] = useState<GenerationMode>("test");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageAsset, setImageAsset] = useState<ImageResult | null>(null);
  const [testResult, setTestResult] = useState<{
    taskId: string;
    videoUrl: string | null;
    seed: number;
    firstFrameAssetId?: string;
    firstFrameUrl?: string;
  } | null>(null);
  const [shotLock, setShotLock] = useState<ShotLockRecord | null>(null);
  const [prodResult, setProdResult] = useState<string | null>(null);

  const shotId = "t2i2v-shot-1";
  const isPreview = workspaceMode === "preview";

  async function generateImage() {
    setLoading(true);
    setError(null);
    const prompt =
      imagePrompt.trim() ||
      `Vertical 9:16 cinematic still for: ${topic}. Photorealistic, no text.`;
    try {
      const res = await fetch("/api/openai/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, workspaceMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生图失败");
      setImageAsset(data);
      if (!videoPrompt.trim()) {
        setVideoPrompt(
          `Cinematic vertical 9:16 video based on the scene: ${topic}. Smooth natural motion, photorealistic.`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runVeoTest() {
    if (!imageAsset || !videoPrompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        shotId,
        workspaceMode,
        mode: "test",
        type: "i2v",
        prompt: videoPrompt,
        model: VEO_MODEL,
      };
      if (isPreview) {
        body.imageBase64 = toBase64(imageAsset.previewUrl ?? imageAsset.publicUrl);
      } else {
        body.imageAssetId = imageAsset.id;
      }

      const res = await fetch("/api/veo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Veo 测试失败");
      setTestResult({
        taskId: data.taskId,
        videoUrl: data.videoUrl,
        seed: data.seed,
        firstFrameAssetId: data.firstFrameAssetId,
        firstFrameUrl: data.firstFrameUrl,
      });
      setShotLock(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function lockShot() {
    if (!testResult || !imageAsset) return;
    setLoading(true);
    setError(null);
    try {
      const input = {
        shotId,
        prompt: videoPrompt,
        seed: testResult.seed,
        firstFrameAssetId: testResult.firstFrameAssetId ?? "preview",
        firstFrameUrl: testResult.firstFrameUrl ?? testResult.videoUrl ?? "",
        duration: DEFAULT_PRODUCTION_DURATION_SEC,
        aspectRatio: "9:16" as const,
        model: VEO_MODEL,
        imageAssetId: isPreview ? undefined : imageAsset.id,
        testTaskId: testResult.taskId,
        testClipUrl: testResult.videoUrl ?? "",
      };

      if (isPreview) {
        setShotLock({
          id: `preview-lock-${shotId}`,
          shotId,
          snapshot: {
            ...input,
            imageAssetId: imageAsset.id,
            characterProfile: null,
            cameraProfile: null,
            lockedAt: new Date().toISOString(),
          },
        });
        setMode("production");
        return;
      }

      const res = await fetch("/api/director/shot-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "锁定失败");
      setShotLock(data);
      setMode("production");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runVeoProduction() {
    if (!shotLock || !imageAsset || isPreview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/veo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId,
          workspaceMode,
          mode: "production",
          type: "i2v",
          prompt: videoPrompt,
          seed: shotLock.snapshot.seed,
          model: shotLock.snapshot.model,
          durationSec: shotLock.snapshot.duration,
          imageAssetId: imageAsset.id,
          shotLockId: shotLock.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "正式生成失败");
      setProdResult(data.videoUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function unlockShot() {
    if (!isPreview) {
      await fetch(`/api/director/shot-lock?shotId=${encodeURIComponent(shotId)}`, {
        method: "DELETE",
      });
    }
    setShotLock(null);
    setMode("test");
    setProdResult(null);
  }

  function onWorkspaceChange(next: WorkspaceMode) {
    setWorkspaceMode(next);
    setImageAsset(null);
    setTestResult(null);
    setShotLock(null);
    setProdResult(null);
    setMode("test");
    setError(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold">AI动态图片（T2I2V）</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          GPT-Image-2 → Veo 测试 → Shot Lock → Veo 正式
        </p>
        <div className="mt-3">
          <WorkspaceModeToggle mode={workspaceMode} onChange={onWorkspaceChange} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <section className="glass-panel mb-4 rounded-xl p-4">
          <input
            className="input-field mb-2 w-full rounded-lg px-3 py-2 text-sm"
            placeholder="主题"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <textarea
            className="input-field mb-2 w-full rounded-lg px-3 py-2 text-sm"
            rows={2}
            placeholder="生图 Prompt（可选）"
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary rounded-lg px-4 py-2 text-sm"
            disabled={loading || !topic.trim()}
            onClick={generateImage}
          >
            {isPreview ? "GPT-Image-2 预览生图" : "GPT-Image-2 生图并保存"}
          </button>
          {imageAsset && (
            <div className="mt-3 flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageAsset.previewUrl ?? imageAsset.publicUrl}
                alt="Generated"
                className="h-32 rounded-lg object-cover"
              />
              <p className="text-xs text-[var(--text-muted)]">
                {imageAsset.model} · {imageAsset.id.slice(0, 8)}
              </p>
            </div>
          )}
        </section>

        {imageAsset && (
          <>
            <section className="glass-panel mb-4 rounded-xl p-4">
              <textarea
                className="input-field mb-3 w-full rounded-lg px-3 py-2 text-sm"
                rows={3}
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
              />
              {!isPreview && (
                <GenerationModeToggle
                  mode={mode}
                  onChange={setMode}
                  productionDisabled={!shotLock}
                />
              )}
              <div className="mt-3 flex gap-2">
                {mode === "test" || isPreview ? (
                  <>
                    <button
                      type="button"
                      className="btn-primary rounded-lg px-4 py-2 text-sm"
                      disabled={loading}
                      onClick={runVeoTest}
                    >
                      Veo 3s {isPreview ? "预览" : "测试"}
                    </button>
                    {!isPreview && (
                      <button
                        type="button"
                        className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                        disabled={loading || !testResult}
                        onClick={lockShot}
                      >
                        确认并锁定
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-primary rounded-lg px-4 py-2 text-sm"
                    disabled={loading || !shotLock}
                    onClick={runVeoProduction}
                  >
                    Veo 正式生成
                  </button>
                )}
              </div>
              {testResult?.videoUrl && (
                <div className="mt-3">
                  <video
                    src={testResult.videoUrl}
                    controls
                    className="max-h-48 rounded-lg"
                  />
                </div>
              )}
              {prodResult && (
                <p className="mt-2 text-xs">
                  正式:{" "}
                  <a href={prodResult} className="underline">
                    {prodResult}
                  </a>
                </p>
              )}
            </section>
            {!isPreview && (
              <ShotLockPanel lock={shotLock} onUnlock={unlockShot} />
            )}
          </>
        )}

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      </div>
    </div>
  );
}
