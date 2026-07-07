# Workspace V2 交付报告

> 范围：仅 `database/workspace/` 基础设施层  
> 未修改 `app/` 业务逻辑、API、UI、Repository、数据库 Schema

---

## 1. Workspace V2 是否完成

**是。** `WORKSPACE_VERSION = 2`，完整目录结构、Health Check、Backup、Settings、Migration（仅改路径）均已实现并通过测试。

---

## 2. 最终目录结构

```text
AI Video OS/
├── database/
│   ├── postgres/
│   ├── migrations/
│   ├── backups/
│   └── runtime/
├── storage/
│   ├── projects/{project-id}/
│   │   ├── images/ videos/ audio/ subtitle/ music/
│   │   ├── effects/ renders/ exports/ thumbnails/
│   │   ├── metadata/ opencut/ cache/ temp/
│   │   ├── director/ timeline/ qa/ voice/ subtitle-json/
│   ├── library/
│   │   ├── materials/ characters/ scenes/ props/
│   │   ├── bgm/ sfx/ voices/ subtitle-styles/
│   │   ├── effects/ transitions/ templates/ prompts/
│   │   ├── lora/ fonts/ stickers/ overlays/ logos/ watermarks/
│   ├── cache/
│   ├── temp/
│   └── exports/
├── models/
│   ├── openai/ claude/ gemini/ deepseek/ flux/
│   ├── comfyui/ whisper/ fishspeech/ cosyvoice/
│   ├── f5tts/ llama/ qwen/ custom/
├── logs/
├── backups/
├── config/
├── plugins/
├── scripts/
├── templates/
└── workspace.json
```

---

## 3. WorkspaceManager API

| 类别 | 方法 / 属性 |
|------|-------------|
| **根路径** | `workspaceRoot`, `databaseRoot`, `storageRoot`, `projectsRoot`, `libraryRoot`, `modelRoot`, `logRoot`, `backupRoot`, `cacheRoot`, `tempRoot`, `exportRoot`, `pluginRoot`, `scriptRoot`, `templateRoot` |
| **子路径** | `getPaths()`, `getLibraryPaths()`, `getModelPaths()`, `getProjectPaths(id)` |
| **配置** | `loadConfig()`, `saveConfig()`, `getSettings()`, `updateSettings()`, `setWorkspaceRoot()`, `reload()` |
| **初始化** | `ensureLayout()`, `checkAndRepair()`, `rescan()` |
| **健康检查** | `runHealthCheck()` |
| **空间** | `scanSpaceUsage()`, `cleanCache()` |
| **备份** | `createBackup()`, `listBackups()`, `restoreBackup()`, `deleteBackup()` |
| **迁移** | `relocateWorkspacePath()` — 仅更新指针，不复制业务数据 |
| **Legacy** | `legacyProductionJsonDir()` |
| **单例** | `getWorkspaceManager()`, `createWorkspaceManager()`, `resetWorkspaceManager()`, `bootstrapWorkspace()` |

---

## 4. 自动初始化能力

- `getWorkspaceManager()` 首次调用触发 `bootstrapWorkspace()`
- `settings.autoInitOnStartup`（默认 `true`）→ 自动 `ensureLayout()`
- 写入根目录 `workspace.json` + 全局指针 `~/.ai-video-os/workspace-pointer.json`

---

## 5. 自动检查能力

- `checkAndRepair()` / `rescan()` — 对照 V2 完整目录清单检查
- `runHealthCheck()` — 检查 database / storage / library / models / logs / backups / cache / exports / config / 权限
- `scanSpaceUsage()` — 按顶层区域统计占用

---

## 6. 自动修复能力

- `settings.autoRepairMissingDirs`（默认 `true`）→ bootstrap 时自动创建缺失目录
- `checkAndRepair({ repair: true })` — 缺失目录 `fs.mkdirSync` 递归创建

---

## 7. 自动备份能力

- `settings.autoBackupEnabled` + `autoBackupIntervalHours` — bootstrap 时按间隔触发轻量备份
- `createBackup({ type: "full" | "incremental" | "manual" })` — 备份 workspace.json + config 快照 + 目录清单（不含媒体二进制）

---

## 8. 自动恢复能力

- `restoreBackup(id, { dryRun: true })` — 默认 dry-run 预览
- `restoreBackup(id, { dryRun: false })` — 从 `backups/{id}/` 恢复 workspace.json 与 config 快照

---

## 9. 自动迁移能力

- `relocateWorkspacePath(newRoot)` — **仅**更新 `workspace.json` + 全局指针
- `dataCopied: false` — 不复制任何业务数据；用户需自行物理移动 `AI Video OS/` 文件夹

---

## 10. 当前已接入模块（database 层）

| 模块 | 路径 |
|------|------|
| Repository 路径桥接 | `database/repositories/shared/paths.ts` |
| Storage Factory | `database/storage/factory.ts` |
| 迁移 Rollback | `database/migrations/framework/rollback.ts` |
| 数据库配置 | `database/config.ts` |
| 初始化脚本 | `database/scripts/init-workspace.sh` |
| 测试 | `database/tests/workspace.test.ts`, `infrastructure.test.ts` |

---

## 11. 尚未接入模块（app 层，待后续 PR）

| 模块 | 当前路径 |
|------|----------|
| Desktop Veo Storage | `app/lib/storage/desktop-veo.ts` |
| Production JSON | `app/lib/storage/production-json.ts` |
| Asset Library | `app/lib/asset-library/*` |
| Materials | `app/lib/materials/*` |
| Usage Tracker | `app/lib/usage-tracker.ts` (`.data/`) |
| Files API | `app/api/files/[...path]/route.ts` |
| OpenCut / FFmpeg 导出 | 各 auto-edit / opencut 模块 |
| Center / Agent / Voice / Subtitle / Music / Effect | 各业务 Center |

---

## 12. 是否修改业务逻辑

**否。** 仅新增/扩展 `database/workspace/` 基础设施。`app/` 零改动，API / UI / Repository 接口 / 数据库 Schema 均未变更。

---

## 13. 是否迁移数据

**否。** 未执行任何数据迁移、双写或 Legacy 文件移动。`legacyProductionJsonDir()` 仍只读指向 `~/Desktop/AI-Veo/Projects`。

---

## 验证

```bash
npm run test:database   # 含 workspace V2 测试
npm run workspace:init  # 手动初始化
```
