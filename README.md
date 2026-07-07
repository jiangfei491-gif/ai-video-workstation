# AI 视频工作台（V3）

本地优先的 AI 视频/图片创作工作台。视频引擎为 **Google Veo（Gemini API）**，图片为 **OpenAI gpt-image**，产物统一保存到桌面 `~/Desktop/AI-Veo`。

## 入口

启动后访问根路径 `/`，会自动跳转到 **`/ai-video`**（创作中心）。

导航模块：

| 路由 | 模块 | 说明 |
|------|------|------|
| `/ai-video` | 创作中心 | 文生视频（T2V）/ 文生图（T2I）工作台，含分镜、Shot Lock、导出 |
| `/dynamic-image` | 动态图片 | 图片生成工作台 |
| `/history` | 历史记录 | 图片/视频产物历史 |
| `/trends` | 热点中心 | TikTok / YouTube 趋势 |

## 启动

```bash
npm install
cp .env.example .env.local   # 填入真实密钥
npm run dev                  # 默认 http://localhost:3000
```

或用脚本一键启动（自动停旧实例、探测端口、打开浏览器，并提示同 WiFi 手机访问地址）：

```bash
scripts/start-workstation.sh   # 启动
scripts/stop-workstation.sh    # 停止所有本地实例
```

生产构建：

```bash
npm run build && npm start
```

## 产物存储

所有生成结果保存到桌面，不再写入 `public/`：

```
~/Desktop/AI-Veo/
├── Images/      # 生成的图片
├── Videos/      # 生成的视频
├── Projects/    # 按项目归档
└── Archive/     # 归档
```

通过 `/api/files/<相对路径>` 对外读取（已做目录穿越防护）。

## 环境变量

见 [.env.example](.env.example)。关键项：

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1
VEO_API_KEY=...                       # Gemini API key
VEO_MODEL_ID=veo-3.1-generate-preview
VEO_ASPECT_RATIO=9:16
```

> ⚠️ 密钥仅放在 `.env.local`（已被 `.gitignore` 忽略），切勿提交。

## Architecture Authority

| 领域 | 模块 |
|------|------|
| Director | `runDirectorPipeline` |
| Duration | `planNarrativeDuration` |
| Timeline | `EditGraph.timeline` |

**Rule:** Do not introduce parallel production controllers without first tracing the existing production chain.
