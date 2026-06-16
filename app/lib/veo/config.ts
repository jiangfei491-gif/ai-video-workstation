export type VeoApiMode = "gemini" | "vertex";

export type VeoAspectRatio = "9:16" | "16:9";

export type VeoDurationSeconds = "4" | "6" | "8";

export type VeoConfig = {
  apiMode: VeoApiMode;
  apiKey: string | null;
  accessToken: string | null;
  projectId: string | null;
  location: string;
  modelId: string;
  geminiBaseUrl: string;
  aspectRatio: VeoAspectRatio;
  durationSeconds: VeoDurationSeconds;
  pollIntervalMs: number;
  pollTimeoutMs: number;
};

function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
  return trimmed.length > 0 ? trimmed : null;
}

function parseApiMode(): VeoApiMode {
  const mode = readEnv("VEO_API_MODE")?.toLowerCase();
  return mode === "vertex" ? "vertex" : "gemini";
}

function parseDuration(): VeoDurationSeconds {
  const raw = readEnv("VEO_DURATION_SECONDS");
  if (raw === "4" || raw === "6" || raw === "8") return raw;
  return "8";
}

function parseAspectRatio(): VeoAspectRatio {
  const raw = readEnv("VEO_ASPECT_RATIO");
  return raw === "16:9" ? "16:9" : "9:16";
}

export function getVeoConfig(): VeoConfig {
  const apiMode = parseApiMode();
  const apiKey = readEnv("VEO_API_KEY");
  const accessToken = readEnv("VEO_ACCESS_TOKEN");

  return {
    apiMode,
    apiKey,
    accessToken,
    projectId: readEnv("VEO_PROJECT_ID"),
    location: readEnv("VEO_LOCATION") ?? "us-central1",
    modelId: readEnv("VEO_MODEL_ID") ?? "veo-3.1-generate-preview",
    geminiBaseUrl:
      readEnv("VEO_API_BASE") ??
      "https://generativelanguage.googleapis.com/v1beta",
    aspectRatio: parseAspectRatio(),
    durationSeconds: parseDuration(),
    pollIntervalMs: Number(readEnv("VEO_POLL_INTERVAL_MS") ?? "10000"),
    pollTimeoutMs: Number(readEnv("VEO_POLL_TIMEOUT_MS") ?? "600000"),
  };
}

export function isVeoConfigured(config: VeoConfig = getVeoConfig()): boolean {
  if (config.apiMode === "vertex") {
    return Boolean(
      config.projectId && (config.accessToken || config.apiKey)
    );
  }
  return Boolean(config.apiKey);
}

export function assertVeoConfigured(config: VeoConfig = getVeoConfig()): void {
  if (!isVeoConfigured(config)) {
    if (config.apiMode === "vertex") {
      throw new Error(
        "未配置视频生成（Vertex 模式）：需要 VEO_PROJECT_ID 与 VEO_ACCESS_TOKEN（或 VEO_API_KEY 作为访问令牌）"
      );
    }
    throw new Error("未配置 VEO_API_KEY，请在 .env.local 中设置 Gemini 接口密钥");
  }
}
