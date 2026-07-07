# JSON → PostgreSQL 映射方案

> **本阶段不迁移**。JSON 继续作为兼容层 / 备份层。  
> **禁止双写、禁止切换读写到 PG**，直至 `migrations/AUDIT_GATE.md` 审核通过。  
> 下表供审核通过后的数据迁移批次（D1+）使用。

## 桌面 JSON（~/Desktop/AI-Veo/Projects/）

| JSON 文件 | 目标表 | 策略 |
|-----------|--------|------|
| `materials.json` | `materials` + `material_analyses` + `material_scripts` | 拆嵌套 |
| `material-schedules.json` | `material_schedules` | 1:1 |
| `characters.json` | `characters` + `legacy_json_mappings` | legacy_json_id |
| `scenes.json` | `scenes` | 同上 |
| `props.json` | `props` | 同上 |
| `image-assets.json` | `assets` (kind=image) | filepath→storage_key |
| `shot-locks.json` | `shot_locks` | 补 project_id |
| `auto-edit-jobs.json` | `jobs` (job_type=render_ffmpeg) | legacy_id |
| `script-evolution-runs.json` | `script_evolution_runs` | |
| `script-evolution-script-records.json` | `script_evolution_records` | |
| `script-evolution-score-records.json` | 合并进 records.scores JSONB 或独立表扩展 | |
| `script-evolution-model-stats.json` | **不迁移**（可重算） | 可选导入 usage_stats |
| `script-evolution-style-stats.json` | **不迁移** | |
| `consistency-model-performance.json` | **不迁移** | |

## 项目内 JSON

| 来源 | 目标表 |
|------|--------|
| `.data/openai-usage-stats.json` | `usage_stats_daily` |

## 浏览器 localStorage

| Key | 目标表 | 说明 |
|-----|--------|------|
| `workbench:t2v` | `projects` + `project_settings` + `project_artifacts` + `artifact_versions` + `timelines` + … | **拆分**，不再整包 |
| `workbench:t2i` | `projects` (pipeline_mode=t2i) | |
| `workbench:history:video` | `project_history_snapshots` | |
| `workbench:history:image` | `project_history_snapshots` | |
| `*-center:ui-settings` | `module_settings` | |
| `workbench:ui-state` | `workbench_sessions.ui_state` | |
| `theme` | `module_settings` (module=theme) | |

## sessionStorage

| Key | 目标表 |
|-----|--------|
| `workbench:glossary` | `glossaries` + `glossary_entries` |
| `workbench:project-script` | `projects.source_script` 或 `project_director_state.script` |
| `workbench-video:*` | **不迁移**（临时缓存）→ 未来上传为 `assets` |

## IndexedDB

| Store | 目标 |
|-------|------|
| `ai-workbench-blobs` | `assets` (kind=thumbnail) + 对象存储 |

## Workbench 字段映射（T2VWorkbenchState）

| Workbench 字段 | 目标 |
|----------------|------|
| topic, shotCount, pipelineMode… | `projects` + `project_settings` |
| director.title/script | `project_director_state` |
| director.storyboard[] | `storyboard_shots` |
| director.prompts[] | `provider_prompts` |
| characterIds/sceneIds/propIds | `project_resources` |
| shotFrames/shotFrameAssets | `shot_assets` + `assets` |
| batchResults/testResult | `assets` (video) + `jobs` |
| editGraph | `project_artifacts` + `artifact_versions` + `timelines` 投影 |
| directorPlan | `artifact_versions` (kind=director_plan) |
| openCutCommands | `clip_agent_runs` + `clip_agent_commands` |
| projectCostLedger | `cost_ledger` |
| canvas* | `canvas_nodes/edges/sections` |
| canvasUi, *Loading | `workbench_sessions` **仅此** |

## legacy_json_mappings 用法

```text
source='materials.json', legacy_key='<uuid>', entity_type='material', entity_id=<new_uuid>
```

双写（若架构另批启用）：读优先 DB，fallback JSON；写 DB + JSON。  
**默认路径不含双写** — 见 `docs/migration-plan.md`。
