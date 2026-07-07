/**
 * 探测本地 TTS Endpoint — 不假设端口，读取 process.env
 */

export type EndpointProbeResult = {
  endpoint: string;
  ok: boolean;
  healthUrl: string;
  docsUrl: string | null;
  healthPath: string;
  latencyMs?: number;
  message: string;
  details?: Record<string, unknown>;
};

const HEALTH_CANDIDATES = ["/health", "/v1/health", "/openapi.json", "/docs", "/"];

export async function probeTtsEndpoint(
  endpointEnv: string,
  timeoutMs = 5000
): Promise<EndpointProbeResult> {
  const endpoint = process.env[endpointEnv]?.trim();
  if (!endpoint) {
    return {
      endpoint: "",
      ok: false,
      healthUrl: "",
      docsUrl: null,
      healthPath: "",
      message: `未配置 ${endpointEnv}`,
    };
  }

  const base = endpoint.replace(/\/$/, "");
  for (const path of HEALTH_CANDIDATES) {
    const url = `${base}${path}`;
    try {
      const t0 = Date.now();
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      const latencyMs = Date.now() - t0;
      if (res.status >= 500) continue;

      let ok = res.ok;
      let message = res.ok ? "运行中" : `HTTP ${res.status}`;

      if (path === "/health" && res.ok) {
        try {
          const data = (await res.json()) as { status?: string; upstreamProbe?: { ok?: boolean } };
          if (data.upstreamProbe && data.upstreamProbe.ok === false) {
            ok = false;
            message = "桥接在线，上游未就绪";
          } else if (data.status === "ok") {
            message = "运行中";
          }
        } catch {
          /* non-json health ok */
        }
      }

      if (path === "/docs" || path === "/openapi.json") {
        ok = res.status === 200;
        message = ok ? "Docs 可访问" : message;
      }

      return {
        endpoint: base,
        ok,
        healthUrl: path === "/health" || path === "/v1/health" ? url : `${base}/health`,
        docsUrl: `${base}/docs`,
        healthPath: path,
        latencyMs,
        message,
      };
    } catch {
      continue;
    }
  }

  return {
    endpoint: base,
    ok: false,
    healthUrl: `${base}/health`,
    docsUrl: `${base}/docs`,
    healthPath: "",
    message: "无法连接",
  };
}

export function readEndpoint(envKey: string): string | undefined {
  return process.env[envKey]?.trim() || undefined;
}
