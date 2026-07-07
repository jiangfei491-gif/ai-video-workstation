# AI Video OS — Legacy Desktop 切除报告

> 完成时间：2026-06-29  
> 工作目录：`~/AI Video OS`（唯一 Single Source of Truth）

---

## 执行摘要

已完成 Legacy Desktop（`~/Desktop/AI-Veo`）运行时兼容层的移除。所有路径经 `WorkspaceManager` / `workspace-paths.ts` 解析；Repository 固定 PostgreSQL；Workbench 会话写入 PostgreSQL；迁移 CLI 通过 `legacy-import-source.ts` 一次性读取旧目录（运行时不可引用）。

---

## 必答五项

### 1. 是否还有任何模块访问 Legacy Desktop？

**否（运行时）。**

| 范围 | 状态 |
|------|------|
| `app/` 全部 TS/TSX | 零 `Desktop/AI-Veo` 引用 |
| `database/` 运行时模块 | 零 Legacy Desktop 路径 |
| 迁移 CLI | 仅 `database/migrations/unification/legacy-import-source.ts` 可通过 `LEGACY_IMPORT_SOURCE_ROOT` 或默认 `~/Desktop/AI-Veo` 读取，**不参与日常运行** |

`migrate:unify` 审计结果：`desktopAccessModules: []`

---

### 2. 是否还有任何模块使用 Legacy JSON（作为 SoT）？

**否。**

- `createRepositoryBundle()` 固定返回 **PostgreSQL** Bundle，无 Legacy / 双写回退
- `database/config.ts`：`repositoryMode: "postgres"`，`readSource: "postgres"`
- JSON 文件若存在，仅作为 **Workspace library 备份**（`storage/library/*/materials.json` 等），由 `libraryJsonPath()` / `productionJsonFilePath()` 指向 Workspace，不再读 Desktop `Projects/`

---

### 3. 是否还有任何模块使用 localStorage 作为业务数据？

**Workbench 核心业务数据：否。**  
**仍存在 localStorage 的模块（非核心 SoT）：**

| 模块 | 用途 | 性质 |
|------|------|------|
| `workbench-persist/storage.ts` | 已移除 localStorage 读写 | ✅ 仅 PostgreSQL |
| `history/image-store.ts` / `video-store.ts` | 生成历史列表（最多 50 条） | 客户端 UI 缓存 |
| `*-center/client-settings.ts` | 各 Center 面板偏好 | 客户端 UI 设置 |
| `theme/store.ts` / `ui-state/store.ts` | 主题、布局 | 客户端 UI 设置 |
| `TrendsHubPage.tsx` | Tab 选中状态 | 客户端 UI 设置 |

Material / Character / Scene / Project / Workbench 状态等业务实体：**PostgreSQL + Workspace 文件系统**。

---

### 4. AI Video OS 是否已经成为唯一工作目录？

**是。**

- 默认根：`~/AI Video OS`（`AI_VIDEO_OS_ROOT` / `WORKSPACE_ROOT` 可覆盖）
- 全局指针：`~/.ai-video-os/workspace-pointer.json`
- 所有媒体、Library、Project、Cache、Log、Backup、Export、OpenCut、FFmpeg 输出均在此树下
- `workspace.json`：`unified: true`
- `isSingleWorkspace: true`（迁移报告确认）

---

### 5. 是否可以直接删除 `~/Desktop/AI-Veo`？

**可以（建议先备份后删除）。**

迁移已完成：

| 指标 | 数值 |
|------|------|
| Materials | 50 |
| Assets | 111 |
| 图片 | 37 |
| 视频 | 2 |
| 音频 | 13 |
| Workspace 容量 | ~96 MB |
| PostgreSQL projects | 1 |

物理目录 `~/Desktop/AI-Veo` 仍存在（`legacyRemaining: true`），但**应用已不再读写**。确认无其他外部工具依赖后，可安全删除或归档。

```bash
# 可选：归档后删除
mv ~/Desktop/AI-Veo ~/Desktop/AI-Veo.archived-$(date +%Y%m%d)
```

---

## 代码变更摘要

| 区域 | 变更 |
|------|------|
| `database/workspace/` | 移除 `legacyRoots`、`legacyProductionJsonDir`、`LEGACY_DESKTOP_VEO_REL`；新增 `libraryJsonPath()` |
| `database/repositories/factory.ts` | 仅 PostgreSQL，移除 Legacy / dual-write 默认路径 |
| `database/config.ts` | 固定 `repositoryMode: "postgres"` |
| `app/lib/storage/*` | 全部委托 WorkspaceManager |
| `app/lib/workbench-persist/*` | Workbench 仅 PostgreSQL |
| `app/api/workbench/session` | 移除 unified 门控 |
| `database/storage/providers/local-storage-provider.ts` | 默认根改为 Workspace |
| 迁移脚本 | 使用 `legacy-import-source.ts`（CLI 专用） |

---

## 验证

```
npm run test:database   → 29/29 通过
npm run migrate:unify   → 成功，errors: []
```

---

## 后续建议（非阻塞）

1. 将 `history/*-store.ts` 迁到 PostgreSQL 或 IndexedDB（消除最后一批 localStorage 业务 adjacent 数据）
2. 删除 `database/repositories/legacy/` 目录（当前 factory 已不再引用，保留仅供历史参考）
3. 更新 `database/DATABASE_DESIGN.md` 等文档中的 Legacy 描述
