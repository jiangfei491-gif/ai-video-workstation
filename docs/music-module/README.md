# 音乐模块（最终版）

> 只有两个功能：**公版歌词**（GPT 全自动收录）+ **原创歌词**（GPT 提示词创作）。
> 不含作曲/编曲/演唱/剪辑/导出/发行，也不含控制台/来源管理/审核/证据/版本/日志/统计/权限/评分等页面。

---

## 最终菜单

```
音乐
├── 公版歌词
└── 原创歌词
```

访问：`http://localhost:3000/music`

---

## 一、公版歌词（全自动 · 高商业价值资产库）

**目标**：不是公版文学库，而是全球最有商业价值、最适合 AI 音乐创作、现代改编与内容创作的公版歌词资产库。

GPT 定时自动执行：

1. **发现**：按五原则筛选候选（公版 + 商业价值 + AI 作曲适配 + 现代改编价值 + 传播价值）
2. **去重**：`dedupe_key = 标题+作者`
3. **抓取**原始网页 → `storage/music/sources/`
4. **解析**歌词正文 + 元数据
5. **自动评分**（12 项维度 + 综合分）+ **现代翻唱热度分析**（★～★★★★★）
6. **门槛**：综合评分 **< 80 分不入库**（解析结果仍保存到 `parsed/` 供审计）
7. **分类打标**：主题 / 情绪 / 场景 / 风格 / 商业价值标签
8. 入库 + 搜索索引

### 优先抓取
欧美传统民谣、经典民歌、圣诞歌、儿歌、爱情/励志/乡村/福音、全球流传传统曲、易改编为现代流行作品。

### 禁止优先
国歌、地方戏曲/祭祀/方言曲、冷门宗教、无商业价值古诗/史料/学术文献等低价值内容。

### 评分维度
商业价值、国际知名度、现代翻唱热度、现代传播能力、改编潜力、AI 作曲适配度、故事性、情绪丰富度、歌词质量、旋律改编潜力、内容创作潜力、综合评分。

### 定时同步
- 由 `instrumentation.ts` 启动进程内调度器，每 10 分钟检查一次
- 到达设置的「同步频率」即自动触发（默认每 24 小时）
- 频率、开关、主题可在公版歌词页顶部「同步设置」中修改
- 可随时点「立即同步」手动触发

### 页面元素
搜索框 · 主题/情绪/场景/风格/商业价值筛选 · 综合评分与翻唱热度 · 歌词列表 · 详情（含收录理由与商业标签）· 立即同步

---

## 二、原创歌词（提示词创作）

用户输入提示词，GPT 自动创作。

**输入**：主题 / 语言 / 风格 / 情绪 / 关键词 / 长度 / 其它要求

**操作**：
- 生成
- 重新生成（按原提示词重来）
- 继续创作（在现有基础上续写）
- 修改（按自然语言指令改写）
- 保存（手动编辑后存为新版本）
- 历史版本（所有版本永久保留，禁止覆盖）

### 页面元素
提示词输入框 · 生成按钮 · 歌词编辑器 · 保存 · 历史版本

---

## 存储

```
storage/music/
├── sources/       # 原始网页（永不覆盖）
├── parsed/        # GPT 解析结果 JSON
├── public/        # 公版歌词正文
├── original/      # 原创歌词正文
├── evidence/      # 证据文件
├── versions/      # 原创历史版本
├── screenshots/   # 预留
└── logs/          # 预留
```

数据库仅保存索引与文件路径（`music_storage_files`）。

---

## 数据库（沿用现有库，不新建）

| 表 | 说明 |
|----|------|
| `music_storage_files` | 文件索引（路径/大小/类型/SHA-256） |
| `music_settings` | 同步频率等设置 |
| `music_public_lyrics` | 公版歌词（分类 + 四维标签 + 去重键 + 指纹） |
| `music_public_lyric_evidence` | 公版证据（后台自动保存，无独立页面） |
| `music_sync_runs` | 同步执行记录 |
| `music_original_lyrics` | 原创歌词 |
| `music_original_lyric_versions` | 原创历史版本 |

已删除的旧表：`music_sources` / `music_public_discoveries` / `music_public_lyric_content` / `music_public_lyric_versions` / `music_public_lyric_reviews` / `music_public_lyric_fingerprints` / `music_crawl_tasks` / `music_original_lyric_scores` / `music_module_roles` / `music_operation_logs`。

---

## 接口

### 公版歌词
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/music-module/public` | 搜索/分类/标签筛选/分页 |
| GET | `/api/music-module/public/:id` | 详情（含正文/来源） |
| GET/POST | `/api/music-module/public/sync` | 同步状态 / 立即同步 |
| GET/PUT | `/api/music-module/settings` | 同步频率设置 |

### 原创歌词
| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/music-module/original` | 列表 / 提示词创作 |
| GET/PATCH/DELETE | `/api/music-module/original/:id` | 详情 / 保存 / 删除 |
| POST | `/api/music-module/original/:id/regenerate` | 重新生成 |
| POST | `/api/music-module/original/:id/continue` | 继续创作 |
| POST | `/api/music-module/original/:id/revise` | 按指令修改 |

---

## 与视频模块耦合

| 检查项 | 结论 |
|--------|------|
| 修改导演/时间轴/图片/视频/导出流程 | 否 |
| 共用数据库 | 是（仅新增 `music_*` 表，不新建库） |
| 影响现有 API | 否（全部在 `/api/music-module/`） |

**音乐模块完全独立**：独立路由、独立 API、独立存储、独立数据表。

---

## 部署

```bash
# 应用/重建 schema（含 DROP 旧表，本模块无历史数据）
psql $DATABASE_URL -f database/schema/130_music_lyrics.sql

# 需配置 OPENAI_API_KEY（GPT-5.5）
# 可选覆盖模型：MUSIC_GPT_MODEL=gpt-5.5

npm run dev
open http://localhost:3000/music
```
