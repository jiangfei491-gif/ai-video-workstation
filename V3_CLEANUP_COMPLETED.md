# V3 Final Cleanup — Completed Report

**Date:** 2026-06-04  
**Branch:** `pre-v3-final-cleanup`  
**Commit:** `backup before v3 final cleanup`

---

## 1. 删除目录列表

| 目录 | 说明 |
|------|------|
| `app/dynamic-video/` | 旧 ComfyUI 动态视频工作台 |
| `app/image-mix/` | 旧图片混剪流水线 |
| `app/tiktok-trends/` | 独立 TikTok 趋势页（已合并至 `/trends`） |
| `app/youtube-trends/` | 独立 YouTube 趋势页（已合并至 `/trends`） |
| `app/api/comfy/` | ComfyUI API |
| `app/api/video/` | Legacy 视频 API（export/storyboard/tts/subtitles 等） |
| `app/api/dynamic-video/` | 旧动态视频 API |
| `app/api/ai-video/` | 旧 AI 视频 API（director/generate-scene） |
| `app/api/assets/` | 旧资产 API |
| `app/api/shot-lock/` | 旧 Shot Lock API（已迁移至 `/api/director/shot-lock`） |
| `app/exports/` | 旧导出静态路由 |
| `app/components/workflows/dynamic-video/` | ComfyUI 工作台组件 |
| `app/components/pipeline/` | 图片混剪流水线 UI |
| `app/components/export/` | 旧导出进度组件 |
| `app/components/storyboard/` | 旧分镜网格组件 |
| `app/lib/comfy/` | ComfyUI 集成库 |
| `app/lib/workflows/` | 旧 dynamic-video 工作流 |
| `app/lib/ai-video/` | 旧 AI 视频 provider（含 Mock） |
| `app/lib/video/` | 旧视频 provider 层（Kling/Mock/Veo 混合） |
| `app/lib/v3/` | 旧 `.data` JSON 存储 |
| `app/lib/export/` | 旧 `public/exports` 导出路径 |
| `public/dynamic-videos/` | 旧视频输出 |
| `public/outputs/` | 旧输出目录 |
| `public/videos/` | 旧视频目录 |
| `public/bgm/` | 旧 BGM 目录 |
| `public/assets/` | 旧 public 资产目录 |
| `scripts/test-export-matrix.ts` | 旧导出测试脚本 |

---

## 2. 删除文件列表（核心）

| 文件 | 说明 |
|------|------|
| `app/lib/video/providers/mock-veo-provider.ts` | Mock Veo（已禁止） |
| `app/lib/video/providers/veo-provider.ts` | 旧 Veo 包装层 |
| `app/lib/video/model-routing.ts` | 旧模型路由 |
| `app/lib/ffmpeg-spawn.ts` | 旧 FFmpeg 进程池（首帧提取已简化） |
| `app/lib/ffmpeg-errors.ts` | 旧 FFmpeg 错误类 |
| `app/lib/ffmpeg-storyboard.ts` | ZoomPan 分镜导出 |
| `app/lib/ffmpeg-dynamic-export.ts` | 动态视频导出 |
| `app/lib/edge-tts-server.ts` | 旧 TTS |
| `app/lib/subtitles.ts` | 旧字幕 |
| `app/lib/video-duration.ts` | ZoomPan 时长计算 |
| `app/lib/export/getExportDirectory.ts` | 旧 `public/exports` 路径 |
| `scripts/run-comfyui.sh` | ComfyUI 启动脚本 |

---

## 3. 保留目录列表

```
app/
├── ai-video/              # AI视频（T2V）
├── dynamic-image/         # AI动态图片（T2I2V）
├── trends/                # 热点中心
├── api/
│   ├── director/          # Director 流水线 + Shot Lock
│   ├── veo/               # Veo 视频生成
│   ├── openai/            # GPT 图片 + 用量统计
│   ├── files/             # 桌面 AI-Veo 文件服务
│   ├── tiktok/trends/     # TikTok 趋势（热点中心）
│   └── youtube/trends/    # YouTube 趋势（热点中心）
├── components/
│   ├── layout/            # AppShell, OpenAIStatsBar
│   ├── trends/            # TrendsHubPage
│   ├── tiktok/            # TikTokTrendsPage
│   ├── youtube/           # YouTubeTrendsPage
│   └── workflows/         # T2I2V, T2V, 共享组件
└── lib/
    ├── director/          # Director 核心
    ├── veo/               # Veo 客户端 + 生成
    ├── shot-lock/         # Shot Lock（正式模式）
    ├── asset-library/     # 图片/视频资产（正式模式）
    ├── storage/           # desktop-veo + production-json
    ├── workspace-mode/    # preview | production
    ├── generation-mode/   # test(3s) | production(8s)
    └── image/             # GPT-Image-2
```

---

## 4. API 列表

| 路由 | 方法 | 用途 |
|------|------|------|
| `/api/veo/generate` | POST | **唯一**视频生成入口（Veo） |
| `/api/director` | POST | Director 流水线（标题/脚本/分镜/Prompt） |
| `/api/director/shot-lock` | POST/GET/DELETE | Shot Lock（仅正式模式） |
| `/api/openai/images` | GET/POST | GPT-Image-2 生图 |
| `/api/openai/stats` | GET | OpenAI 用量统计 |
| `/api/files/[...path]` | GET | 读取 `~/Desktop/AI-Veo` 文件 |
| `/api/tiktok/trends` | GET | TikTok 热点（热点中心） |
| `/api/youtube/trends` | GET | YouTube 热点（热点中心） |

---

## 5. 页面列表

| 路径 | 导航标签 | 组件 |
|------|----------|------|
| `/dynamic-image` | AI动态图片 | `T2I2VWorkbench` |
| `/ai-video` | AI视频 | `T2VWorkbench` |
| `/trends` | 热点中心 | `TrendsHubPage` |
| `/` | — | 重定向至 `/dynamic-image` |

导航仅保留上述 3 项（`app/lib/nav-config.ts`）。

---

## 6. Build 结果

```
npm run build  →  ✅ SUCCESS (exit 0)

Route (app)
┌ ○ /
├ ○ /ai-video
├ ○ /dynamic-image
├ ○ /trends
├ ƒ /api/director
├ ƒ /api/director/shot-lock
├ ƒ /api/files/[...path]
├ ƒ /api/openai/images
├ ƒ /api/openai/stats
├ ƒ /api/tiktok/trends
├ ƒ /api/veo/generate
└ ƒ /api/youtube/trends
```

TypeScript: **0 errors**  
Build errors: **0**

> 注：Turbopack 对 `desktop-veo.ts` 中 `os.homedir()` 有 NFT 追踪警告，不影响构建成功。

---

## 7. Lint 结果

```
npm run lint  →  ✅ SUCCESS (exit 0, 0 errors, 0 warnings)
```

---

## 8. Veo 验证状态

| 检查项 | 状态 |
|--------|------|
| 代码中无 Kling 引用 | ✅ |
| 代码中无 ComfyUI 引用 | ✅ |
| 代码中无 Mock Veo 引用 | ✅ |
| 视频生成统一 `/api/veo/generate` | ✅ |
| Veo Provider 位于 `app/lib/veo/client.ts` | ✅ |
| `VEO_USE_MOCK` 已移除 | ✅ |
| 真实 Veo E2E（需 `VEO_API_KEY`） | ⚠️ 未在本机验证（密钥未配置） |

---

## 9. 导出目录验证

| 检查项 | 状态 |
|--------|------|
| `~/Desktop/AI-Veo/` 已创建 | ✅ |
| `~/Desktop/AI-Veo/Images/` | ✅ |
| `~/Desktop/AI-Veo/Videos/` | ✅ |
| `~/Desktop/AI-Veo/Projects/` | ✅ |
| `~/Desktop/AI-Veo/Archive/` | ✅ |
| 正式模式图片保存至 `Images/` | ✅ |
| 正式模式视频保存至 `Videos/` | ✅ |
| Shot Lock / 资产索引保存至 `Projects/*.json` | ✅ |
| 旧路径 `public/exports` 等已废弃 | ✅ |
| 桌面启动器 `~/Desktop/AI启动.command` | ✅ |
| 桌面停止器 `~/Desktop/AI结束.command` | ✅ |

---

## 10. 工作台模式

### 测试模式（preview）

- 图片：返回 `data:image/png;base64,...`，不写磁盘
- 视频：返回 `data:video/mp4;base64,...`，不写磁盘
- 不写数据库 / JSON 索引
- 关闭浏览器即消失
- Shot Lock 仅客户端状态，不支持 8s 正式生成

### 正式模式（production）

- 图片：保存至 `~/Desktop/AI-Veo/Images/`
- 视频：保存至 `~/Desktop/AI-Veo/Videos/`
- Shot Lock：保存至 `~/Desktop/AI-Veo/Projects/shot-locks.json`
- 资产索引：`~/Desktop/AI-Veo/Projects/image-assets.json`
- 访问 URL：`/api/files/Images/...` 或 `/api/files/Videos/...`

---

## 11. 桌面启动器

**路径：** `~/Desktop/AI启动.command` → `scripts/start-workstation.sh`

**停止：** `~/Desktop/AI结束.command` → `scripts/stop-workstation.sh`

---

## 12. Dev 验证

```
npm run dev  →  ✅ Ready
GET /dynamic-image  →  200
GET /api/openai/stats  →  200
```

---

## 13. 遗留问题

1. **`VEO_API_KEY` 未配置** — 真实 Veo 生成需在 `.env.local` 设置密钥后方可 E2E 验证。
2. **Turbopack NFT 警告** — `generate.ts` 引用 `os.homedir()` 触发构建追踪警告，功能正常。
3. **热点 API** — `/api/tiktok/trends` 与 `/api/youtube/trends` 保留供热点中心使用，不在用户指定的三核心 API 之列，但为 `/trends` 页面所必需。
4. **Legacy 路由重定向** — `nav-config.ts` 保留 `/dynamic-video`、`/image-mix` 等到新页面的映射，便于旧书签跳转。

---

## 14. Git 回滚点

```bash
git checkout pre-v3-final-cleanup
git log -1  # backup before v3 final cleanup
```

---

**V3 Final Cleanup 完成。未新增额外功能。**
