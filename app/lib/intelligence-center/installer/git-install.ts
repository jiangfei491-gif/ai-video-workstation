import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { IcDiscoveredItem } from "../types";

/**
 * 安全 git 安装：只 clone、不执行任何下载后的代码。
 * - host 白名单
 * - 浅克隆 + 跳过 LFS 大文件
 * - spawn 数组传参（无 shell 注入），禁用交互式认证，带超时
 */

const HOST_ALLOWLIST = new Set([
  "github.com",
  "www.github.com",
  "huggingface.co",
  "www.modelscope.cn",
  "modelscope.cn",
  "gitlab.com",
]);

export type InstallKind = "git-clone" | "model" | "plugin" | "workflow" | "none";

export interface DerivedInstall {
  kind: InstallKind;
  gitUrl: string;
}

function ghUrlFromAny(u: string): string | null {
  const m = u.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  return `https://github.com/${m[1]}/${m[2].replace(/\.git$/, "")}.git`;
}

/** 从发现项推导可 clone 的 git 地址 + 安装类型；无法安装返回 null */
export function deriveInstall(item: IcDiscoveredItem): DerivedInstall | null {
  const meta = item.metadata ?? {};
  const url = item.url ?? "";

  switch (item.platformId) {
    case "github":
      return { kind: "git-clone", gitUrl: `https://github.com/${item.externalId.replace(/\.git$/, "")}.git` };
    case "huggingface":
    case "ai-video":
      return { kind: "model", gitUrl: `https://huggingface.co/${item.externalId}` };
    case "modelscope":
      return { kind: "model", gitUrl: `https://www.modelscope.cn/${item.externalId}.git` };
    case "comfyui":
    case "mcp": {
      const gh = ghUrlFromAny(url) || (typeof meta.repository === "string" ? ghUrlFromAny(meta.repository) : null);
      return gh ? { kind: item.platformId === "comfyui" ? "plugin" : "git-clone", gitUrl: gh } : null;
    }
    case "npm": {
      const repo = typeof meta.repository === "string" ? meta.repository : "";
      const gh = ghUrlFromAny(repo);
      return gh ? { kind: "git-clone", gitUrl: gh } : null;
    }
    default:
      // pypi / arxiv / ai-news：无稳定 git 源，不支持自动安装
      return null;
  }
}

function safeSeg(s: string): string {
  return s.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "item";
}

export function installsRoot(): string {
  const root =
    process.env.AI_VIDEO_OS_ROOT?.trim() ||
    process.env.WORKSPACE_ROOT?.trim() ||
    path.join(homedir(), "AI-Veo");
  return path.join(root, "intelligence-center", "installs");
}

export function installDestFor(item: IcDiscoveredItem): string {
  const name = safeSeg(item.externalId.replace(/\//g, "__") || item.title);
  return path.join(installsRoot(), item.platformId, name);
}

export interface CloneResult {
  ok: boolean;
  path?: string;
  log: string;
  alreadyExists?: boolean;
}

/** 执行浅克隆（不执行仓库内任何代码）。仅由用户在审核通过后手动触发。 */
export async function runGitClone(gitUrl: string, dest: string, timeoutMs = 180000): Promise<CloneResult> {
  let host: string;
  try {
    const parsed = new URL(gitUrl);
    if (parsed.protocol !== "https:") return { ok: false, log: `拒绝：仅允许 https，收到 ${parsed.protocol}` };
    host = parsed.host.toLowerCase();
  } catch {
    return { ok: false, log: `拒绝：非法 URL ${gitUrl}` };
  }
  if (!HOST_ALLOWLIST.has(host)) {
    return { ok: false, log: `拒绝：host 不在白名单（${host}）` };
  }
  if (existsSync(dest)) {
    return { ok: true, path: dest, log: "目标已存在，跳过克隆（已安装）", alreadyExists: true };
  }
  mkdirSync(path.dirname(dest), { recursive: true });

  return new Promise<CloneResult>((resolve) => {
    const args = ["clone", "--depth", "1", "--single-branch", gitUrl, dest];
    const child = spawn("git", args, {
      env: { ...process.env, GIT_LFS_SKIP_SMUDGE: "1", GIT_TERMINAL_PROMPT: "0" },
    });
    let log = `$ git ${args.join(" ")}\n`;
    const onData = (b: Buffer) => {
      log += b.toString();
      if (log.length > 8000) log = log.slice(-8000);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, log: log + `\n[超时 ${timeoutMs}ms，已终止]` });
    }, timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, log: log + `\n[启动失败] ${e.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? { ok: true, path: dest, log } : { ok: false, log: log + `\n[git 退出码 ${code}]` });
    });
  });
}
