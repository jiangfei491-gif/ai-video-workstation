# AI 视频 — 导演流水线（Director Pipeline）

> 版本：1.0  
> 日期：2026-05-27  
> 范围：主题 → 标题 → 脚本 → 导演分镜 → Veo/Kling Prompt  
> **不含**真实视频模型调用，**不修改**现有 UI。

---

## 目录

1. [数据结构](#1-数据结构)
2. [GPT 调用关系](#2-gpt-调用关系)
3. [输出格式](#3-输出格式)
4. [Veo 接入点](#4-veo-接入点)
5. [Kling 接入点](#5-kling-接入点)

---

## 1. 数据结构

### 1.1 目录结构

```
app/lib/director/
├── index.ts                      # 统一导出
├── types.ts                      # 类型定义
├── director-chat.ts              # 模型路由 GPT 调用封装
├── generate-title.ts             # 步骤 1：标题
├── generate-script.ts            # 步骤 2：脚本
├── generate-storyboard.ts        # 步骤 3：导演分镜
├── generate-provider-prompts.ts  # 步骤 4：Veo/Kling Prompt
└── run-director-pipeline.ts      # 编排入口

app/api/ai-video/director/
└── route.ts                      # POST 统一 API
```

### 1.2 导演分镜单镜头 — `DirectorStoryboardShot`

```typescript
type DirectorStoryboardShot = {
  sceneNumber: number;   // 镜头序号，从 1 开始
  duration: number;      // 时长（秒，3–15）
  character: string;     // 角色
  action: string;        // 动作
  environment: string;   // 环境/场景
  camera: string;        // 镜头语言
  transition: string;    // 转场（Cut / Fade / Dissolve / …）
  narration: string;     // 旁白（中文）
};
```

**示例（镜头 1）：**

| 字段 | 值 |
|------|-----|
| sceneNumber | 1 |
| character | 年轻女孩 |
| action | 推开咖啡馆门进入 |
| environment | 现代咖啡馆 |
| camera | 广角跟拍 |
| transition | Cut |
| duration | 5 |
| narration | （该镜头口播文本） |

### 1.3 Provider Prompt — `DirectorProviderPrompt`

```typescript
type DirectorProviderPrompt = {
  sceneNumber: number;
  providerPrompt: string;  // 英文 text-to-video Prompt
};
```

### 1.4 流水线完整结果 — `DirectorPipelineResult`

```typescript
type DirectorPipelineResult = {
  title: string;
  script: string;
  storyboard: DirectorStoryboardShot[];
  prompts: DirectorProviderPrompt[];
};
```

### 1.5 API 请求体

```typescript
// POST /api/ai-video/director
{
  topic: string;       // 必填：用户主题
  shotCount?: number;  // 可选：镜头数，默认 5，范围 1–12
}
```

---

## 2. GPT 调用关系

### 2.1 流水线顺序

```
用户输入 topic
        ↓
┌───────────────────────────────────────┐
│ generateTitle()                       │
│ 模型：GPT-5.5（task: "title"）         │
│ 输出：title（单条中文标题）             │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│ generateScript(topic, title)          │
│ 模型：GPT-5.5-Pro（task: "script-advanced"）│
│ 输出：script（口播脚本）                │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│ generateStoryboard(title, script)     │
│ 模型：GPT-5.5-Pro（task: "director-storyboard"）│
│ 输出：storyboard[]（N 个镜头）          │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│ generateProviderPrompts(title, sb)    │
│ 模型：GPT-5.5-Pro（task: "video-prompt"）│
│ 输出：prompts[]（每镜头英文 Prompt）    │
└───────────────────────────────────────┘
        ↓
{ title, script, storyboard, prompts }
```

### 2.2 模型路由

定义于 `app/lib/video/model-routing.ts`，由 `director-chat.ts` 执行：

| 步骤 | Task 键 | 目标模型 | 回退 |
|------|---------|----------|------|
| 标题 | `title` | gpt-5.5 | `buildModelCandidates()` |
| 脚本 | `script-advanced` | gpt-5.5-pro | 同上 |
| 导演分镜 | `director-storyboard` | gpt-5.5-pro | 同上 |
| 视频 Prompt | `video-prompt` | gpt-5.5-pro | 同上 |

`directorChatCompletion(task, system, user)` 优先尝试目标模型，404 时自动回退至环境配置的可用模型链。

### 2.3 编排入口

```typescript
import { runDirectorPipeline } from "@/app/lib/director";

const result = await runDirectorPipeline(
  { topic: "都市咖啡馆偶遇", shotCount: 5 },
  (step, message) => console.log(step, message)
);
```

---

## 3. 输出格式

### 3.1 API 响应示例

**请求：**

```bash
curl -X POST http://localhost:3000/api/ai-video/director \
  -H "Content-Type: application/json" \
  -d '{"topic":"都市咖啡馆里的意外重逢","shotCount":3}'
```

**响应：**

```json
{
  "title": "咖啡馆里那一眼，改变了整个下午",
  "script": "你有没有过这样的瞬间……\n\n（口播正文，180–260 字）",
  "storyboard": [
    {
      "sceneNumber": 1,
      "duration": 5,
      "character": "年轻女孩",
      "action": "推开咖啡馆门进入",
      "environment": "现代咖啡馆",
      "camera": "广角跟拍",
      "transition": "Cut",
      "narration": "那天下午，她推开了那扇门。"
    },
    {
      "sceneNumber": 2,
      "duration": 5,
      "character": "年轻女孩与陌生男子",
      "action": "目光相遇，停顿",
      "environment": "咖啡馆内，暖色灯光",
      "camera": "中景双人镜头",
      "transition": "Fade",
      "narration": "然后，她看见了那个人。"
    }
  ],
  "prompts": [
    {
      "sceneNumber": 1,
      "providerPrompt": "A young woman pushes open the glass door and enters a modern café, wide tracking shot, warm afternoon light, cinematic 9:16 vertical, photorealistic, smooth motion, 5 seconds."
    },
    {
      "sceneNumber": 2,
      "providerPrompt": "Medium two-shot inside a cozy café, a young woman and a man make eye contact and pause, soft bokeh background, cinematic 9:16, photorealistic, 5 seconds."
    }
  ]
}
```

### 3.2 错误响应

| HTTP | 场景 |
|------|------|
| 400 | 缺少 `topic` 或 JSON 无效 |
| 503 | 未配置 `OPENAI_API_KEY` |
| 502 | GPT 调用失败或解析失败 |

---

## 4. Veo 接入点

导演流水线完成后，`prompts[]` 可直接传入 **VideoProvider 层**（高质量模式）。

### 4.1 调用位置

```
runDirectorPipeline() 返回 prompts
        ↓
app/lib/video/native-video-pipeline.ts
  generateNativeSceneQueue(scenes, videoPrompts, "high")
        ↓
app/lib/video/get-video-provider.ts
  getVideoProviderByQuality("high")  →  veoVideoProvider
        ↓
app/lib/video/providers/veo-provider.ts
  generateVideo({ sceneId, videoPrompt, durationSec })
        ↓
（当前 Mock）mock-veo-provider.ts
（未来）Google Veo API
```

### 4.2 字段映射

| Director 输出 | VideoProvider 输入 |
|---------------|-------------------|
| `prompts[i].providerPrompt` | `NativeVideoGenerateInput.videoPrompt` |
| `storyboard[i].sceneNumber` | `NativeVideoGenerateInput.sceneId` → `"scene-{N}"` |
| `storyboard[i].duration` | `NativeVideoGenerateInput.durationSec` |
| `storyboard[i]` 全字段 | `NativeVideoGenerateInput.directorScene`（可选上下文） |

### 4.3 建议接入代码（未来）

```typescript
// 在 ai-video 视频生成步骤中（尚未实现 UI 绑定）
import { runDirectorPipeline } from "@/app/lib/director";
import { generateNativeSceneQueue } from "@/app/lib/video";

const { storyboard, prompts } = await runDirectorPipeline({ topic });

const promptMap = Object.fromEntries(
  prompts.map((p) => [`scene-${p.sceneNumber}`, p.providerPrompt])
);

const scenes = storyboard.map((s) => ({
  id: `scene-${s.sceneNumber}`,
  order: s.sceneNumber,
  scene: s.environment,
  character: s.character,
  action: s.action,
  camera: s.camera,
  durationSec: s.duration,
  transition: s.transition,
}));

await generateNativeSceneQueue(scenes, promptMap, "high"); // Veo
```

**当前阶段：** 仅完成 Director Pipeline；Veo 仍为 Mock，见 `mock-veo-provider.ts`。

---

## 5. Kling 接入点

与 Veo 相同，区别仅为质量档位映射至 Kling（标准模式，默认）。

### 5.1 调用位置

```
runDirectorPipeline() 返回 prompts
        ↓
generateNativeSceneQueue(scenes, promptMap, "standard")
        ↓
getVideoProviderByQuality("standard")  →  klingVideoProvider
        ↓
app/lib/video/providers/kling-provider.ts
  generateVideo({ sceneId, videoPrompt, durationSec })
        ↓
（当前 Mock）mock-kling-provider.ts
（未来）Kling AI API
```

### 5.2 质量档位映射

| 前端选项 | quality | Provider |
|---------|---------|----------|
| 标准模式（默认） | `"standard"` | Kling |
| 高质量模式 | `"high"` | Veo |

定义：`app/lib/video/video-provider.ts` → `QUALITY_TO_PROVIDER`

### 5.3 同一 Prompt 双引擎

`generateProviderPrompts()` 生成的 `providerPrompt` 为 **引擎无关** 的英文 text-to-video Prompt，Veo 与 Kling 共用同一套 `prompts[]`，仅通过 `quality` 参数选择 Provider。

### 5.4 建议 API 串联（未来）

```
POST /api/ai-video/director     →  { title, script, storyboard, prompts }
POST /api/ai-video/generate     →  单镜 Mock / 真实 Veo|Kling（已有）
POST /api/ai-video/export       →  FFmpeg concat scene-*.mp4（待建）
```

**当前阶段：** Kling 仍为 Mock；Director Pipeline 已产出可消费的 `prompts[]`。

---

## 附录：与 AI动态图片 的边界

| 维度 | AI动态图片 | Director Pipeline（AI视频） |
|------|-----------|---------------------------|
| 分镜用途 | 静态图 + ComfyUI I2V | 原生 T2V Prompt |
| 分镜字段 | imagePrompt, motionPrompt | character, action, environment, camera |
| GPT 路由 | `/api/video/*`, `/api/dynamic-video/*` | `/api/ai-video/director` |
| 视频生成 | ComfyUI | Veo / Kling（Mock） |

两套流水线 **完全独立**，Director Pipeline 不修改、不依赖 ComfyUI 或图片混剪 API。

---

*文档结束 — Director Pipeline v1.0*
