# AI Video OS — Workspace 数据归一最终报告

> 执行命令：`AI_VIDEO_OS_ROOT="$HOME/AI Video OS" npm run migrate:unify`  
> 执行时间：2026-07-01  
> Legacy 数据：**未删除**（按要求保留只读）

---

## 1. 共迁移 Project 数量

**1**（`legacy-import` → `projects` 表 + `storage/projects/00000000-0000-4000-a000-000000000003/`）

## 2. 共迁移 Material 数量

**50**（`materials.json` → `storage/library/materials/` 备份 + PostgreSQL `materials`）

## 3. 共迁移 Character 数量

**0**（Legacy `characters.json` 为空数组 `[]`）

## 4. 共迁移 Asset 数量

**111**（PostgreSQL `assets` 表，含 JSON 导入 + Storage 扫盘索引）

## 5. 共迁移图片数量

**37**（`Desktop/AI-Veo/Images/` → `storage/projects/{id}/images/`）

## 6. 共迁移视频数量

**2**（`Desktop/AI-Veo/Videos/` → `storage/projects/{id}/videos/`）

## 7. 共迁移音频数量

**13**（`Desktop/AI-Veo/Audio/` + `BGM/` → 项目 `audio/` + 库 `library/bgm/`）

## 8. 共迁移字幕数量

**0**（Legacy 无 `.srt/.ass/.vtt` 文件）

## 9. PostgreSQL 数据量

| 表 | 行数 |
|----|------|
| projects | 1 |
| materials | 50 |
| characters | 0 |
| scenes | 0 |
| props | 0 |
| assets | 111 |
| workbench_sessions | 0 |
| timelines | 0 |
| jobs | 0 |
| cost_ledger | 0 |

## 10. Workspace 总容量

**96.42 MB**（`/Users/mac/AI Video OS/`）

## 11. 是否还有 Legacy 数据未迁移

**是（保留，未删除）。**  
`~/Desktop/AI-Veo/` 仍存在，作为只读备份。文件已**复制**到 Workspace（非移动）。  
Workbench 浏览器数据需导出后导入：将 `workbench:t2v` 导出为  
`~/AI Video OS/backups/workbench-export.json`，再执行：

```bash
WORKBENCH_EXPORT_PATH="$HOME/AI Video OS/backups/workbench-export.json" npm run migrate:unify
```

## 12. 是否还有模块访问 Desktop

**运行时：否**（统一模式下 `workspace-paths.ts` 已指向 Workspace 目录）。  
**Legacy 根目录**：仍配置在 `workspace.json.legacyRoots` 供对账，不再作为写入目标。

## 13. 是否还有模块访问 localStorage

**是（部分）。**  
统一模式下 **Workbench 主状态** 已改走 PostgreSQL（`/api/workbench/session`），不再写入 localStorage。  
以下仍用 localStorage（UI 设置 / 主题 / 历史 / Center 客户端设置，非核心业务数据）：

- `app/lib/*-center/client-settings.ts`
- `app/lib/theme/store.ts`
- `app/lib/ui-state/store.ts`
- `app/lib/history/*-store.ts`

## 14. 是否还有模块使用绝对路径

**否（业务模块）。**  
临时文件、缓存、日志均经 `WorkspaceManager.tempRoot/cacheRoot/logRoot`。  
OpenCut vendor 回退仍用 `process.cwd()/vendor`（repo 内置，非用户数据）。

## 15. 是否已实现 AI Video OS 唯一 Workspace

**部分实现 — 核心数据已归一，尚未 100% 完成。**

| 项 | 状态 |
|----|------|
| 媒体文件归 Workspace | ✅ |
| Library JSON 备份 + PG 主读 | ✅ |
| `workspace.json unified: true` | ✅ |
| 默认 Repository = PostgreSQL | ✅（`unified` 时自动切换） |
| Legacy Desktop 删除 | ❌ 禁止，仍保留 |
| Workbench → PG | ⚠️ 需浏览器导出 JSON 后二次迁移 |
| 全部 localStorage 清除 | ⚠️ UI 设置类仍保留 |

---

## 迁移工具

| 路径 | 说明 |
|------|------|
| `database/migrations/unification/` | 迁移框架 |
| `npm run migrate:unify` | 一键执行 |
| `~/AI Video OS/UNIFICATION_REPORT.json` | 机器可读报告 |

## 验证

```bash
npm run test:database   # 30/30 通过
curl http://localhost:3000/api/workspace/status  # unified: true
```
