# 平台 UI 中文化 — 术语表与改造优先级

> 机器可读源文件：`app/lib/i18n/ui-glossary.ts`  
> 原则：**会进模型 / API / 数据结构的不翻译**；界面说明、按钮、状态尽量中文；专业概念可「中文 (English)」。

---

## 1. 三层规则

| 层级 | 代码 | 说明 | 示例 |
|------|------|------|------|
| **保留英文** | `keepEnglish` | 品牌、格式、环境变量、协议命令 | OpenCut、SRT、GPT-4.1、`OPENAI_API_KEY` |
| **中文 + 括注** | `zhWithEn` | 产品概念、引擎名，与代码/文档对齐 | 导演方案 (Director Plan)、故事图谱 (Story Graph) |
| **纯中文** | `zhOnly` | 不涉及 API 的通用 UI | 预览、导出、渲染、流水线、智能体 |

### 绝对不翻译

- 用户输入并提交给模型的 **Prompt 正文**（标签可写「提示词」）
- `workbench` 状态键、`batchResults`、`editGraph` 等 **JSON 字段名**
- Provider / 模型 / 音色 ID：`Alloy`、`Nova`、`gpt-4.1-mini`
- FFmpeg 滤镜名、OpenCut 命令：`insertSubtitle`、`blackdetect`、`xfade`
- `@角色` / `@道具` 等 **引用语法**

---

## 2. 核心术语对照（Top 60）

### 2.1 保留英文

| 英文 | 说明 |
|------|------|
| OpenCut | 内嵌剪辑器产品名 |
| OpenAI / DeepSeek / Claude / Gemini | 服务商品牌 |
| ElevenLabs / Edge TTS / Whisper | 语音/识别品牌 |
| FLUX / Veo / GPT Image | 生成模型品牌 |
| SRT / ASS / WebVTT / MP4 / JSON / FCPXML | 文件与编码格式 |
| OPENAI_API_KEY / DEEPSEEK_API_KEY | 环境变量（配置提示原文展示） |
| insertSubtitle | OpenCut 命令 |
| MIT / Docker | 开源/部署说明 |

### 2.2 中文为主（建议括注英文，首次出现即可）

| 英文 | 推荐中文 | 括注 |
|------|----------|------|
| Director Plan | 导演方案 | Director Plan |
| EditGraph | 剪辑图 | EditGraph |
| Story Graph | 故事图谱 | Story Graph |
| Timeline | 时间线 | Timeline |
| Render Engine | 渲染引擎 | Render Engine |
| Subtitle Engine | 字幕引擎 | Subtitle Engine |
| Voice Engine | 配音引擎 | Voice Engine |
| Music Engine | 音乐引擎 | Music Engine |
| Transition Engine | 转场引擎 | Transition Engine |
| Effect Engine | 特效引擎 | Effect Engine |
| Rule Engine | 规则引擎 | Rule Engine |
| Prompt | 提示词 | Prompt |
| Negative Prompt | 负向提示 | Negative Prompt |
| BGM | 背景音乐 | BGM |
| Ducking | 侧链闪避 | Ducking |
| BPM | BPM 节拍 | BPM |
| Visual QC | 画面质检 | Visual QC |
| Multi-Take | 多 Take 方案 | Multi-Take |
| Localization | 多语言本地化 | Localization |
| NLE | 非线性剪辑 | NLE |
| Concat | 硬切拼接 | Concat |
| Provider | 服务商 | Provider |

### 2.3 纯中文

| 英文原词 | 中文 |
|----------|------|
| Agent | 智能体（如 DeepSeek 音乐智能体） |
| Pipeline | 流水线 |
| Preview | 预览 |
| Export | 导出 |
| Render | 渲染 |
| Storyboard | 分镜 |
| QC | 质检 |
| Fade In / Fade Out | 淡入 / 淡出 |
| Default | 默认 |
| Phase 2 / Phase 5 | 阶段 2 / 阶段 5（或「第二期」） |

---

## 3. 混排风格规范

统一为：**中文描述 + 必要时的英文专名**，避免整句英文。

| ❌ 不推荐 | ✅ 推荐 |
|----------|----------|
| Force rerun EditGraph | 强制重新编排剪辑图 (EditGraph) |
| Story Graph · AI Decision · Roadmap | 故事图谱 · AI 决策 · 路线图 |
| DeepSeek Music Agent | DeepSeek 音乐智能体 |
| 待生成 Plan | 待生成导演方案 |
| EditGraph 时间线已写入 | 剪辑图时间线已写入 |
| 配音 Ducking | 配音侧链闪避 (Ducking) |
| Export JSON | 导出 JSON（格式名保留） |

路线图标题建议从 `Subtitle Engine · 字幕引擎` 改为 **`字幕引擎 (Subtitle Engine)`**，与上表一致。

---

## 4. 改造优先级

### P1 — 英文密度高，用户天天看（先做）

| 路由 | 重点文件 | 说明 |
|------|----------|------|
| `/canvas` | `edit-center/*`、`roadmap.ts` | 路线图、Story Graph、Export、Engine 面板 |
| `/ai-video` | `T2VWorkbench`、`StoryboardImageDashboard`、`VideoSettingsPanel` | Prompt 标签、QC、模型选择说明 |
| `/ai-director` | `AiDirectorShell`、`DirectorModulesPanel` | Plan / EditGraph 状态文案 |

### P2 — 各 Center + 全局二次传播

| 路由 | 重点文件 | 说明 |
|------|----------|------|
| `/voice-center` | `VoiceCenterShell` | Provider 列表保留 ID，分组标题中文化 |
| `/subtitle-center` | `SubtitleCenterShell` | Rule Engine、格式导出按钮 |
| `/music-center` | `MusicCenterShell` | BGM、Ducking、Agent 页头 |
| `/effect-center` | `EffectCenterShell` | 同上 |
| `/qa-center` | `QaCenterShell` | FFmpeg 检测项可中文说明 + 保留技术名 |
| `/ai-edit` | `AiAutoEditShell`、`OpenCutEditorEmbed` | 外壳中文，OpenCut 内嵌走 `OPENCUT_UI_LOCALE=zh` |
| 全局 | `module-registry.ts`、`ModuleLeadStrip` | 改一处，素材/导演/各页页头同步 |

### P3 — 已较中文，收尾

| 路由 | 说明 |
|------|------|
| `/materials`、`/resources`、`/history` | placeholder、零散英文 |
| `localization/index.ts` | 扩展 `MESSAGES.zh`，edit-center 接 `tUi()` |

---

## 5. 现有 i18n 资产

| 资产 | 路径 | 状态 |
|------|------|------|
| UI 文案 stub | `app/lib/auto-edit/engines/localization/index.ts` | `tUi()` 存在，**几乎未接入组件**；`zh.storyGraph` 仍为英文 |
| 字幕术语库 | 同上 `loadGlossary()` | 用于字幕翻译，非界面 i18n |
| OpenCut locale | `app/lib/opencut/config.ts` | 内嵌编辑器中文 |
| 导航 | `app/lib/nav-config.ts` | **已全部中文** ✅ |
| 本术语表 | `app/lib/i18n/ui-glossary.ts` | 新增，可用 `uiLabel()` |

---

## 6. 实施步骤（建议）

1. **定稿术语表** — 团队确认上表，尤其 EditGraph / Director Plan 译法。
2. **P1 改字符串** — 只改 JSX 展示文案，不动 API 与 store 键名。
3. **统一 roadmap + module-registry** — 减少重复劳动。
4. **扩展 `MESSAGES.zh` + 接 `tUi()`** — 新文案走集中管理。
5. **可选 `next-intl`** — 若未来要多语言界面，再引入框架；当前优先简体中文即可。

---

## 7. 扫描摘要（2025-06）

- 主界面**已是中文为主**；英文多为 **品牌 + 架构混排**。
- 英文最重：`/canvas` > `/ai-video` > `/ai-director` > 各 Center。
- 最高杠杆单文件：`app/lib/auto-edit/engines/roadmap.ts`、`app/lib/platform/module-registry.ts`。

如需按 P1 批次直接改代码，说明从哪条路由开始即可。
