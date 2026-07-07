# AI Video OS — Workspace V2

> **原则**：Workspace Root 是 AI Video OS 的唯一根目录。所有模块通过 `WorkspaceManager` 获取路径，禁止硬编码绝对路径。

## 默认路径

```text
~/AI Video OS/
```

## 目录结构（V2）

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

## WorkspaceManager API

```typescript
import { getWorkspaceManager } from "../workspace";

const ws = getWorkspaceManager(); // 首次调用自动 bootstrap

// 根路径
ws.workspaceRoot;
ws.databaseRoot;
ws.storageRoot;
ws.projectsRoot;
ws.libraryRoot;
ws.modelRoot;
ws.logRoot;
ws.backupRoot;
ws.cacheRoot;
ws.tempRoot;
ws.exportRoot;
ws.pluginRoot;
ws.scriptRoot;
ws.templateRoot;

// 子路径
ws.getProjectPaths("project-id").videos;
ws.getLibraryPaths().lora;
ws.getModelPaths().whisper;

// 初始化 / 检查 / 修复
ws.ensureLayout({ includeProjectId?: string });
ws.checkAndRepair();
ws.rescan();
await ws.runHealthCheck();

// 设置
ws.getSettings();
ws.updateSettings({ autoBackupEnabled: true });
ws.setWorkspaceRoot("/Volumes/SSD/AI Video OS");
ws.relocateWorkspacePath("/new/path"); // 仅改指针，不复制数据

// 空间 / 缓存
await ws.scanSpaceUsage();
await ws.cleanCache({ includeTemp: true });

// 备份
await ws.createBackup({ type: "full" });
ws.listBackups();
await ws.restoreBackup(id, { dryRun: true });
ws.deleteBackup(id);

ws.legacyProductionJsonDir(); // 未迁移：~/Desktop/AI-Veo/Projects
```

## 可配置路径

| 方式 | 说明 |
|------|------|
| `AI_VIDEO_OS_ROOT` / `WORKSPACE_ROOT` | 环境变量（最高优先级） |
| `workspace.json` | 工作区根目录配置 |
| `~/.ai-video-os/workspace-pointer.json` | 全局指针 |
| `ws.setWorkspaceRoot()` | 程序化设置 |

## 初始化

```bash
npm run workspace:init
# 或
AI_VIDEO_OS_ROOT="/Volumes/SSD/AI Video OS" bash database/scripts/init-workspace.sh
```

## 开发规范（强制）

所有 Center、Agent、OpenCut、FFmpeg、Storage、Export 等模块**必须**通过 `getWorkspaceManager()` 获取路径。

## Legacy 兼容

- `legacyProductionJsonDir()` → `~/Desktop/AI-Veo/Projects`（只读，不删不迁）
- V1 `config/workspace.json` 仍可读取，新写入统一到根目录 `workspace.json`
