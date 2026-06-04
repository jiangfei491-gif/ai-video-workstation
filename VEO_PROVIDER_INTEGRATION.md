# Veo Provider 接入文档

> 版本：1.0  
> 日期：2026-05-27  
> 范围：AI 视频模块 · 单镜头真实 Veo 生成（第一阶段）

---

## 目录

1. [Veo 配置](#1-veo-配置)
2. [API 调用流程](#2-api-调用流程)
3. [轮询机制](#3-轮询机制)
4. [视频保存位置](#4-视频保存位置)
5. [错误处理](#5-错误处理)
6. [后续多镜头扩展方案](#6-后续多镜头扩展方案)

---

## 1. Veo 配置

### 1.1 环境变量（`.env.local`）

#### 模式 A：Gemini API（推荐，默认）

适用于 [Google AI Studio](https://aistudio.google.com/) 获取的 API Key。

```bash
# 必填 — Gemini API Key（独立于 OPENAI_API_KEY）
VEO_API_KEY=your_gemini_api_key

# 可选
VEO_MODEL_ID=veo-3.1-generate-preview
VEO_ASPECT_RATIO=9:16
VEO_DURATION_SECONDS=8
VEO_POLL_INTERVAL_MS=10000
VEO_POLL_TIMEOUT_MS=600000
```

`VEO_PROJECT_ID` 在 Gemini 模式下 **不需要**。

#### 模式 B：Vertex AI

适用于 Google Cloud 项目 + OAuth Access Token。

```bash
VEO_API_MODE=vertex
VEO_PROJECT_ID=your-gcp-project-id
VEO_ACCESS_TOKEN=your_oauth_access_token
# 或使用 VEO_API_KEY 作为 Bearer Token
VEO_LOCATION=us-central1
VEO_MODEL_ID=veo-3.1-generate-preview
```

Access Token 可通过 `gcloud auth print-access-token` 获取（需定期刷新）。

#### 开发回退 Mock

```bash
VEO_USE_MOCK=true
```

未配置 `VEO_API_KEY` 时也会自动回退 Mock（便于本地无 Key 开发）。

### 1.2 配置读取

文件：`app/lib/video/providers/veo-config.ts`

| 函数 | 说明 |
|------|------|
| `getVeoConfig()` | 读取全部环境变量 |
| `isVeoConfigured()` | 判断是否可调用真实 API |
| `assertVeoConfigured()` | 未配置时抛出明确错误 |

### 1.3 官方文档

- Gemini API Veo：[Generate videos with Veo 3.1](https://ai.google.dev/gemini-api/docs/video)
- Vertex AI Veo：[Generate videos from text](https://cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-text)

---

## 2. API 调用流程

### 2.1 应用内调用链

```
POST /api/ai-video/generate-scene
  { "prompt": "..." }
        ↓
veoVideoProvider.generateVideo()
        ↓
veo-api-client.ts
  startVeoGeneration()      → predictLongRunning
  pollVeoOperationUntilDone() → 轮询 operation
  downloadVeoVideo()        → 下载 MP4 字节
        ↓
veo-storage.ts
  saveVeoVideo()            → public/exports/veo/*.mp4
        ↓
响应 { taskId, status, videoUrl, provider: "veo" }
```

### 2.2 与 Director Pipeline 的关系

Director Pipeline（`/api/ai-video/director`）产出 `prompts[].providerPrompt`，可直接作为本接口的 `prompt`：

```bash
# 1. 导演流水线
curl -X POST http://localhost:3000/api/ai-video/director \
  -H "Content-Type: application/json" \
  -d '{"topic":"都市咖啡馆偶遇","shotCount":1}'

# 2. 取 prompts[0].providerPrompt 生成真实 Veo 视频
curl -X POST http://localhost:3000/api/ai-video/generate-scene \
  -H "Content-Type: application/json" \
  -d '{"prompt":"A young woman pushes open a café door..."}'
```

**Director Pipeline 本身未修改。**

### 2.3 Gemini API HTTP 细节

**提交任务：**

```http
POST https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning
x-goog-api-key: {VEO_API_KEY}
Content-Type: application/json

{
  "instances": [{ "prompt": "..." }],
  "parameters": {
    "aspectRatio": "9:16",
    "durationSeconds": "8"
  }
}
```

**响应：**

```json
{ "name": "operations/abc123xyz" }
```

### 2.4 Vertex AI HTTP 细节（可选）

**提交：**

```http
POST https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/us-central1/publishers/google/models/{MODEL}:predictLongRunning
Authorization: Bearer {ACCESS_TOKEN}
```

**轮询：**

```http
POST .../models/{MODEL}:fetchPredictOperation
{ "operationName": "projects/.../operations/..." }
```

---

## 3. 轮询机制

实现文件：`app/lib/video/providers/veo-api-client.ts`

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `VEO_POLL_INTERVAL_MS` | 10000 | 每次轮询间隔（官方建议 10s） |
| `VEO_POLL_TIMEOUT_MS` | 600000 | 最长等待 10 分钟 |

### 3.1 Gemini 轮询

```http
GET https://generativelanguage.googleapis.com/v1beta/{operation_name}
x-goog-api-key: {VEO_API_KEY}
```

检查 `done === true` 后，从响应提取：

```
response.generateVideoResponse.generatedSamples[0].video.uri
```

### 3.2 完成条件

- `done: true` 且无 `error` → 成功
- `done: true` 且有 `error` → 失败，抛出 `VeoApiError`
- 超时 → 抛出 `Veo 生成超时`

### 3.3 API Route 超时

`app/api/ai-video/generate-scene/route.ts` 设置：

```typescript
export const maxDuration = 600; // 10 分钟
```

Veo 生成通常需 1–5 分钟，请求会 **同步阻塞** 直到完成或超时。

---

## 4. 视频保存位置

### 4.1 磁盘路径

```
public/exports/veo/veo-{timestamp}-{taskId}-{uuid}.mp4
```

RunPod 环境：

```
/workspace/ai-workspace/public/exports/veo/
```

### 4.2 公开访问 URL

```
/exports/veo/veo-{timestamp}-{taskId}-{uuid}.mp4
```

由现有 `app/exports/[...path]/route.ts` 提供下载，无需新增路由。

### 4.3 实现文件

- `app/lib/video/providers/veo-storage.ts` — 写入磁盘
- `app/lib/export/getExportDirectory.ts` — 解析 exports 根目录

---

## 5. 错误处理

### 5.1 错误类型

`VeoApiError`（`veo-api-client.ts`）：

| 场景 | 示例 |
|------|------|
| 未配置 Key | `未配置 VEO_API_KEY` |
| 提交失败 | `Veo 提交失败 [403]: ...` |
| 轮询失败 | `Veo 轮询失败 [500]: ...` |
| 任务失败 | `operation.error.message` |
| 无视频资源 | `Veo 完成但未返回视频资源` |
| 下载失败 | `Veo 视频下载失败 [404]: ...` |
| 超时 | `Veo 生成超时（>600000ms）` |

### 5.2 Provider 返回

`veo-provider.ts` 捕获异常后返回：

```json
{
  "taskId": "veo-failed-...",
  "status": "failed",
  "videoUrl": null,
  "provider": "veo",
  "error": "错误描述"
}
```

### 5.3 API HTTP 状态码

| 状态 | 场景 |
|------|------|
| 400 | 缺少 `prompt` |
| 503 | 未配置 Veo API Key |
| 502 | Veo 生成失败 |
| 200 | 成功，`status: "completed"` |

### 5.4 常见配置问题

| 问题 | 解决 |
|------|------|
| 403 Permission denied | 确认 API Key 已开通 Veo 付费预览 |
| 404 model not found | 检查 `VEO_MODEL_ID` 是否为有效 Veo 模型 |
| 超时 | 增大 `VEO_POLL_TIMEOUT_MS` 或重试 |
| Mock 回退 | 设置 `VEO_API_KEY` 并确保 `VEO_USE_MOCK` 未设为 `true` |

---

## 6. 后续多镜头扩展方案

当前阶段：**单镜头** `POST /api/ai-video/generate-scene`。

### 6.1 多镜头顺序生成（建议 P1）

```typescript
// 伪代码 — 不改 Director Pipeline
const { storyboard, prompts } = await runDirectorPipeline({ topic });

for (const p of prompts) {
  await fetch("/api/ai-video/generate-scene", {
    method: "POST",
    body: JSON.stringify({ prompt: p.providerPrompt }),
  });
  // 每镜保存至 public/exports/veo/scene-{N}.mp4
}
```

或新建 `POST /api/ai-video/generate-all` 服务端批量调用 `veoVideoProvider`。

### 6.2 FFmpeg 拼接（建议 P2）

参考 `ffmpeg-dynamic-export.ts`，新建 `ffmpeg-native-export.ts`：

```
public/exports/veo/scene-1.mp4
public/exports/veo/scene-2.mp4
        ↓ concat
public/exports/native-final-*.mp4
```

### 6.3 异步任务模式（建议 P3）

当前同步轮询会占用 HTTP 连接数分钟。未来可改为：

1. `POST /api/ai-video/generate-scene` → 立即返回 `{ taskId, status: "processing" }`
2. 后台 worker 轮询 Veo
3. `GET /api/ai-video/status?taskId=...` 查询进度
4. SSE 推送完成事件（参考 `dynamic-video/export/stream`）

### 6.4 Kling 接入（不在本阶段）

Kling 保持 Mock，接口与 Veo 对称：

```
app/lib/video/providers/kling-provider.ts
app/lib/video/providers/kling-api-client.ts
```

Director Pipeline 的 `providerPrompt` 同样适用于 Kling text-to-video。

---

## 附录：文件清单

| 文件 | 职责 |
|------|------|
| `veo-config.ts` | 环境变量 |
| `veo-api-client.ts` | 官方 API 提交 / 轮询 / 下载 |
| `veo-storage.ts` | 保存至 `public/exports/veo/` |
| `veo-provider.ts` | VideoProvider 实现 |
| `mock-veo-provider.ts` | 无 Key 时回退 |
| `app/api/ai-video/generate-scene/route.ts` | 单镜头 HTTP 入口 |

---

## 快速验证

```bash
# .env.local
VEO_API_KEY=your_key_here

# 启动
npm run dev

# 生成第一条真实 Veo 视频
curl -X POST http://localhost:3000/api/ai-video/generate-scene \
  -H "Content-Type: application/json" \
  -d '{"prompt":"A cinematic vertical 9:16 shot of a young woman entering a modern café, warm afternoon light, smooth tracking camera, photorealistic, 8 seconds."}'
```

成功响应示例：

```json
{
  "taskId": "abc123xyz",
  "status": "completed",
  "videoUrl": "/exports/veo/veo-1710000000-abc123xyz-a1b2c3d4.mp4",
  "provider": "veo"
}
```

浏览器访问 `http://localhost:3000{videoUrl}` 即可播放。

---

*文档结束 — Veo Provider Integration v1.0*
