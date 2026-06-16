import { assertVeoConfigured, getVeoConfig, type VeoConfig } from "./config";

export class VeoApiError extends Error {
  readonly statusCode?: number;
  readonly details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = "VeoApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

type VeoProgressCallback = (message: string) => void;

type StartGenerationResult = {
  operationName: string;
  taskId: string;
};

type OperationStatus = {
  done: boolean;
  error?: { message?: string; code?: number };
  videoUri?: string;
  videoBytes?: Buffer;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTaskId(operationName: string): string {
  const parts = operationName.split("/");
  return parts[parts.length - 1] ?? operationName;
}

async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: { message?: string; status?: string };
    };
    if (body.error?.message) return body.error.message;
    return JSON.stringify(body);
  } catch {
    return await res.text();
  }
}

function authHeaders(config: VeoConfig): Record<string, string> {
  if (config.apiMode === "vertex") {
    const token = config.accessToken ?? config.apiKey;
    if (!token) throw new VeoApiError("Vertex AI 缺少访问令牌");
    return { Authorization: `Bearer ${token}` };
  }
  if (!config.apiKey) throw new VeoApiError("缺少 VEO_API_KEY");
  return { "x-goog-api-key": config.apiKey };
}

function geminiStartUrl(config: VeoConfig): string {
  return `${config.geminiBaseUrl}/models/${config.modelId}:predictLongRunning`;
}

function vertexStartUrl(config: VeoConfig): string {
  return `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.modelId}:predictLongRunning`;
}

function vertexPollUrl(config: VeoConfig): string {
  return `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.modelId}:fetchPredictOperation`;
}

function buildRequestBody(
  prompt: string,
  config: VeoConfig,
  durationSeconds?: number
): unknown {
  const dur = durationSeconds ?? Number(config.durationSeconds);
  const allowed: number = dur <= 4 ? 4 : dur <= 6 ? 6 : 8;
  return {
    instances: [{ prompt }],
    parameters: {
      aspectRatio: config.aspectRatio,
      durationSeconds: allowed,
    },
  };
}

function extractVideoUriFromOperation(body: Record<string, unknown>): string | null {
  const response = body.response as Record<string, unknown> | undefined;
  if (!response) return null;

  const generateVideoResponse = response.generateVideoResponse as
    | Record<string, unknown>
    | undefined;
  const generatedSamples = generateVideoResponse?.generatedSamples as
    | Record<string, unknown>[]
    | undefined;
  const firstSample = generatedSamples?.[0];
  const video = firstSample?.video as Record<string, unknown> | undefined;
  if (typeof video?.uri === "string") return video.uri;

  const generatedVideos = response.generatedVideos as
    | Record<string, unknown>[]
    | undefined;
  const firstVideo = generatedVideos?.[0];
  const nestedVideo = firstVideo?.video as Record<string, unknown> | undefined;
  if (typeof nestedVideo?.uri === "string") return nestedVideo.uri;

  const predictions = response.predictions as Record<string, unknown>[] | undefined;
  const firstPrediction = predictions?.[0];
  if (typeof firstPrediction?.videoUri === "string") return firstPrediction.videoUri;

  return null;
}

function extractVideoBytesFromOperation(body: Record<string, unknown>): Buffer | null {
  const response = body.response as Record<string, unknown> | undefined;
  if (!response) return null;

  const generateVideoResponse = response.generateVideoResponse as
    | Record<string, unknown>
    | undefined;
  const generatedSamples = generateVideoResponse?.generatedSamples as
    | Record<string, unknown>[]
    | undefined;
  const video = generatedSamples?.[0]?.video as Record<string, unknown> | undefined;
  if (typeof video?.bytesBase64Encoded === "string") {
    return Buffer.from(video.bytesBase64Encoded, "base64");
  }

  const generatedVideos = response.generatedVideos as
    | Record<string, unknown>[]
    | undefined;
  const nestedVideo = generatedVideos?.[0]?.video as Record<string, unknown> | undefined;
  if (typeof nestedVideo?.bytesBase64Encoded === "string") {
    return Buffer.from(nestedVideo.bytesBase64Encoded, "base64");
  }

  return null;
}

export async function startVeoGeneration(
  prompt: string,
  onProgress?: VeoProgressCallback,
  durationSeconds?: number
): Promise<StartGenerationResult> {
  const config = getVeoConfig();
  assertVeoConfigured(config);

  const url =
    config.apiMode === "vertex" ? vertexStartUrl(config) : geminiStartUrl(config);

  onProgress?.(`提交视频生成任务（${config.modelId}）…`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(config),
    },
    body: JSON.stringify(buildRequestBody(prompt, config, durationSeconds)),
  });

  if (!res.ok) {
    const message = await parseErrorResponse(res);
    throw new VeoApiError(
      `视频生成提交失败 [${res.status}]：${message}`,
      res.status,
      message
    );
  }

  const body = (await res.json()) as { name?: string };
  const operationName = body.name;
  if (!operationName) {
    throw new VeoApiError("视频生成未返回任务 ID", 502, body);
  }

  const taskId = extractTaskId(operationName);
  onProgress?.(`任务已提交，任务 ID：${taskId}`);
  return { operationName, taskId };
}

async function pollGeminiOperation(
  operationName: string,
  config: VeoConfig,
  onProgress?: VeoProgressCallback
): Promise<OperationStatus> {
  const url = `${config.geminiBaseUrl}/${operationName}`;
  const res = await fetch(url, {
    headers: authHeaders(config),
  });

  if (!res.ok) {
    const message = await parseErrorResponse(res);
    throw new VeoApiError(
      `视频生成轮询失败 [${res.status}]：${message}`,
      res.status,
      message
    );
  }

  const body = (await res.json()) as Record<string, unknown>;
  const done = Boolean(body.done);
  const error = body.error as OperationStatus["error"] | undefined;

  if (done && error) {
    return {
      done: true,
      error,
    };
  }

  if (done) {
    onProgress?.("视频生成完成，准备下载…");
    return {
      done: true,
      videoUri: extractVideoUriFromOperation(body) ?? undefined,
      videoBytes: extractVideoBytesFromOperation(body) ?? undefined,
    };
  }

  onProgress?.("视频生成中…");
  return { done: false };
}

async function pollVertexOperation(
  operationName: string,
  config: VeoConfig,
  onProgress?: VeoProgressCallback
): Promise<OperationStatus> {
  const res = await fetch(vertexPollUrl(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(config),
    },
    body: JSON.stringify({ operationName }),
  });

  if (!res.ok) {
    const message = await parseErrorResponse(res);
    throw new VeoApiError(
      `Vertex 视频生成轮询失败 [${res.status}]：${message}`,
      res.status,
      message
    );
  }

  const body = (await res.json()) as Record<string, unknown>;
  const done = Boolean(body.done);
  const error = body.error as OperationStatus["error"] | undefined;

  if (done && error) {
    return { done: true, error };
  }

  if (done) {
    onProgress?.("视频生成完成，准备下载…");
    return {
      done: true,
      videoUri: extractVideoUriFromOperation(body) ?? undefined,
      videoBytes: extractVideoBytesFromOperation(body) ?? undefined,
    };
  }

  onProgress?.("视频生成中…");
  return { done: false };
}

export async function pollVeoOperationUntilDone(
  operationName: string,
  onProgress?: VeoProgressCallback
): Promise<OperationStatus> {
  const config = getVeoConfig();
  const startedAt = Date.now();

  while (Date.now() - startedAt < config.pollTimeoutMs) {
    const status =
      config.apiMode === "vertex"
        ? await pollVertexOperation(operationName, config, onProgress)
        : await pollGeminiOperation(operationName, config, onProgress);

    if (status.done) {
      if (status.error) {
        throw new VeoApiError(
          status.error.message ?? "视频生成失败",
          status.error.code
        );
      }
      if (!status.videoUri && !status.videoBytes) {
        throw new VeoApiError("视频生成完成但未返回视频资源");
      }
      return status;
    }

    await sleep(config.pollIntervalMs);
  }

  throw new VeoApiError(
    `视频生成超时（超过 ${Math.round(config.pollTimeoutMs / 1000)} 秒），请稍后重试`
  );
}

export async function downloadVeoVideo(
  videoUri: string,
  onProgress?: VeoProgressCallback
): Promise<Buffer> {
  const config = getVeoConfig();
  onProgress?.("正在下载视频文件…");

  const res = await fetch(videoUri, {
    headers: authHeaders(config),
    redirect: "follow",
  });

  if (!res.ok) {
    const message = await parseErrorResponse(res);
    throw new VeoApiError(
      `视频下载失败 [${res.status}]：${message}`,
      res.status,
      message
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateVeoVideoFromPrompt(
  prompt: string,
  onProgress?: VeoProgressCallback,
  durationSeconds?: number
): Promise<{ taskId: string; buffer: Buffer }> {
  const { operationName, taskId } = await startVeoGeneration(
    prompt,
    onProgress,
    durationSeconds
  );
  const result = await pollVeoOperationUntilDone(operationName, onProgress);

  if (result.videoBytes) {
    return { taskId, buffer: result.videoBytes };
  }

  if (!result.videoUri) {
    throw new VeoApiError("视频生成未返回可下载地址");
  }

  const buffer = await downloadVeoVideo(result.videoUri, onProgress);
  return { taskId, buffer };
}
