"use client";

import { useCallback, useEffect, useState } from "react";
import { FiDownload, FiExternalLink, FiRefreshCw } from "react-icons/fi";
import { getT2VState } from "@/app/lib/workbench-persist/t2v-store";
import LoadingButton from "@/app/components/workflows/shared/LoadingButton";
import type { OpenCutEditorResolveResult } from "@/app/api/opencut/resolve-editor-url/route";
import { OPENCUT_VENDOR_EDITOR_URL } from "@/app/lib/opencut/constants";

type Props = {
  editorUrl?: string;
};

type BootStatus = "loading" | "starting" | "ready" | "error";

export default function OpenCutEditorEmbed({ editorUrl }: Props) {
  const targetUrl = editorUrl?.trim() || OPENCUT_VENDOR_EDITOR_URL;
  const [bootStatus, setBootStatus] = useState<BootStatus>("loading");
  const [bootMessage, setBootMessage] = useState("正在连接内嵌 OpenCut…");
  const [resolved, setResolved] = useState<OpenCutEditorResolveResult | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const waitForReady = useCallback(async () => {
    setBootStatus("loading");
    setBootMessage("正在连接内嵌 OpenCut…");

    try {
      const resolveRes = await fetch("/api/opencut/resolve-editor-url");
      const resolveData = (await resolveRes.json()) as OpenCutEditorResolveResult;
      setResolved(resolveData);

      if (resolveData.url.includes("opencut.app")) {
        setBootStatus("ready");
        return;
      }

      const bootRes = await fetch("/api/opencut/bootstrap");
      const bootData = (await bootRes.json()) as {
        status: string;
        message?: string;
        error?: string;
      };

      if (bootData.status === "ready") {
        setBootStatus("ready");
        return;
      }

      if (bootData.status === "error") {
        setBootMessage(bootData.error ?? "启动失败");
        setBootStatus("error");
        return;
      }

      setBootStatus("starting");
      setBootMessage(
        bootData.message ?? "正在拉取并启动内嵌 OpenCut 中文版（首次约 5–15 分钟）"
      );

      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const check = await fetch("/api/opencut/bootstrap");
        const checkData = (await check.json()) as { status: string };
        if (checkData.status === "ready") {
          setBootStatus("ready");
          return;
        }
      }

      setBootMessage("启动超时，请确认 Docker 已运行后点击重新加载");
      setBootStatus("error");
    } catch (err) {
      setBootMessage(err instanceof Error ? err.message : "连接失败");
      setBootStatus("error");
    }
  }, []);

  useEffect(() => {
    void waitForReady();
  }, [waitForReady]);

  const src = resolved?.url ?? targetUrl;

  const downloadProject = useCallback(async () => {
    setExportLoading(true);
    try {
      const res = await fetch("/api/opencut/export-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workbench: getT2VState() }),
      });
      const data = (await res.json()) as {
        filename?: string;
        project?: unknown;
        error?: string;
      };
      if (!res.ok || !data.project) throw new Error(data.error ?? "导出失败");
      const blob = new Blob([JSON.stringify(data.project, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename ?? "剪辑工程.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setExportLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    setLoadError(false);
    setIframeKey((k) => k + 1);
    void waitForReady();
  }, [waitForReady]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-inset)]">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
        <p className="text-xs text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">OpenCut 剪辑引擎</span>
          {bootStatus === "ready"
            ? " · 内嵌中文版"
            : bootStatus === "starting"
              ? " · 正在启动…"
              : " · 连接中…"}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <LoadingButton
            variant="secondary"
            loading={exportLoading}
            loadingText="导出中…"
            onClick={() => void downloadProject()}
            className="!px-2.5 !py-1.5 !text-xs"
          >
            <FiDownload className="h-3.5 w-3.5" />
            下载剪辑工程
          </LoadingButton>
          <button type="button" onClick={reload} className="edit-icon-btn" title="重新加载">
            <FiRefreshCw className="h-3.5 w-3.5" />
          </button>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="edit-icon-btn"
            title="在新窗口打开"
          >
            <FiExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {bootStatus !== "ready" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          {bootStatus === "error" ? (
            <p className="text-sm text-[var(--danger)]">{bootMessage}</p>
          ) : (
            <>
              <p className="text-sm text-[var(--text-secondary)]">{bootMessage}</p>
              <p className="max-w-md text-xs text-[var(--text-caption)]">
                OpenCut 为 MIT 开源，我们已将中文版复制到{" "}
                <code className="font-mono">vendor/opencut</code> 并在本地运行。需安装 Docker
                Desktop。
              </p>
            </>
          )}
          {bootStatus === "error" && (
            <button type="button" onClick={reload} className="btn-primary rounded-lg px-4 py-2 text-sm">
              重新加载
            </button>
          )}
        </div>
      ) : loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">无法内嵌加载编辑器</p>
          <button type="button" onClick={reload} className="btn-primary rounded-lg px-4 py-2 text-sm">
            重新加载
          </button>
        </div>
      ) : (
        <iframe
          key={iframeKey}
          src={src}
          title="OpenCut 视频编辑器"
          className="min-h-0 flex-1 w-full border-0 bg-black"
          allow="clipboard-write; fullscreen"
          onError={() => setLoadError(true)}
        />
      )}
    </div>
  );
}
