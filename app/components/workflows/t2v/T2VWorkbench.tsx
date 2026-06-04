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

type DirectorShot = {
  sceneNumber: number;
  providerPrompt: string;
  duration: number;
};

type Props = {
  initialTopic?: string;
};

export default function T2VWorkbench({ initialTopic = "" }: Props) {
  const [topic, setTopic] = useState(initialTopic);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("preview");
  const [mode, setMode] = useState<GenerationMode>("test");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [director, setDirector] = useState<{
    title: string;
    script: string;
    prompts: DirectorShot[];
  } | null>(null);
  const [activeShotIdx, setActiveShotIdx] = useState(0);
  const [testResult, setTestResult] = useState<{
    taskId: string;
    videoUrl: string | null;
    seed: number;
    firstFrameAssetId?: string;
    firstFrameUrl?: string;
  } | null>(null);
  const [shotLock, setShotLock] = useState<ShotLockRecord | null>(null);
  const [prodResult, setProdResult] = useState<string | null>(null);

  const isPreview = workspaceMode === "preview";
  const activePrompt = director?.prompts[activeShotIdx];
  const shotId = activePrompt ? `t2v-shot-${activePrompt.sceneNumber}` : "";

  async function runDirector() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, shotCount: 3 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Director 失败");
      setDirector({
        title: data.title,
        script: data.script,
        prompts: (data.prompts as { sceneNumber: number; providerPrompt: string }[]).map(
          (p, i) => ({
            sceneNumber: p.sceneNumber,
            providerPrompt: p.providerPrompt,
            duration: data.storyboard?.[i]?.duration ?? 5,
          })
        ),
      });
      setActiveShotIdx(0);
      setTestResult(null);
      setShotLock(null);
      setProdResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runVeoTest() {
    if (!activePrompt) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/veo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId,
          workspaceMode,
          mode: "test",
          type: "t2v",
          prompt: activePrompt.providerPrompt,
          model: VEO_MODEL,
        }),
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
    if (!testResult || !activePrompt) return;
    setLoading(true);
    setError(null);
    try {
      const input = {
        shotId,
        prompt: activePrompt.providerPrompt,
        seed: testResult.seed,
        firstFrameAssetId: testResult.firstFrameAssetId ?? "preview",
        firstFrameUrl: testResult.firstFrameUrl ?? testResult.videoUrl ?? "",
        duration: DEFAULT_PRODUCTION_DURATION_SEC,
        aspectRatio: "9:16" as const,
        model: VEO_MODEL,
        testTaskId: testResult.taskId,
        testClipUrl: testResult.videoUrl ?? "",
      };

      if (isPreview) {
        setShotLock({
          id: `preview-lock-${shotId}`,
          shotId,
          snapshot: {
            ...input,
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
    if (!shotLock || !activePrompt || isPreview) return;
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
          type: "t2v",
          prompt: activePrompt.providerPrompt,
          seed: shotLock.snapshot.seed,
          model: shotLock.snapshot.model,
          durationSec: shotLock.snapshot.duration,
          aspectRatio: shotLock.snapshot.aspectRatio,
          shotLockId: shotLock.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Veo 正式生成失败");
      setProdResult(data.videoUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function unlockShot() {
    if (!activePrompt) return;
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
    setDirector(null);
    setTestResult(null);
    setShotLock(null);
    setProdResult(null);
    setMode("test");
    setError(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold">AI视频（T2V）</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          主题 → Director → Veo 测试 → Shot Lock → Veo 正式
        </p>
        <div className="mt-3">
          <WorkspaceModeToggle mode={workspaceMode} onChange={onWorkspaceChange} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <section className="glass-panel mb-4 rounded-xl p-4">
          <label className="mb-2 block text-sm text-[var(--text-secondary)]">
            主题
          </label>
          <input
            className="input-field mb-3 w-full rounded-lg px-3 py-2 text-sm"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="输入视频主题"
          />
          <button
            type="button"
            className="btn-primary rounded-lg px-4 py-2 text-sm"
            disabled={loading || !topic.trim()}
            onClick={runDirector}
          >
            运行 Director 流水线
          </button>
        </section>

        {director && (
          <>
            <section className="glass-panel mb-4 rounded-xl p-4">
              <h2 className="mb-2 text-sm font-medium">{director.title}</h2>
              <p className="mb-3 line-clamp-4 text-xs text-[var(--text-muted)]">
                {director.script}
              </p>
              <div className="flex flex-wrap gap-2">
                {director.prompts.map((p, i) => (
                  <button
                    key={p.sceneNumber}
                    type="button"
                    onClick={() => {
                      setActiveShotIdx(i);
                      setTestResult(null);
                      setShotLock(null);
                      setProdResult(null);
                      setMode("test");
                    }}
                    className={`rounded px-2 py-1 text-xs ${
                      i === activeShotIdx ? "nav-item-active" : "bg-[var(--bg-inset)]"
                    }`}
                  >
                    镜头 {p.sceneNumber}
                  </button>
                ))}
              </div>
            </section>

            <section className="glass-panel mb-4 rounded-xl p-4">
              {!isPreview && (
                <div className="mb-3 flex items-center justify-between">
                  <GenerationModeToggle
                    mode={mode}
                    onChange={setMode}
                    productionDisabled={!shotLock}
                  />
                </div>
              )}
              <p className="mb-3 line-clamp-4 text-xs text-[var(--text-muted)]">
                {activePrompt?.providerPrompt}
              </p>
              {mode === "test" || isPreview ? (
                <div className="flex gap-2">
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
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-primary rounded-lg px-4 py-2 text-sm"
                  disabled={loading || !shotLock}
                  onClick={runVeoProduction}
                >
                  Veo 正式生成（{DEFAULT_PRODUCTION_DURATION_SEC}s）
                </button>
              )}
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
                  正式视频:{" "}
                  <a href={prodResult} className="underline" target="_blank">
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

        {error && (
          <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>
        )}
      </div>
    </div>
  );
}
