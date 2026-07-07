# 对象存储目录规范

> DB 表：`assets` 仅存元数据。二进制 **禁止** 写入 PostgreSQL。

## Bucket 布局

```text
s3://{bucket}/                          # 默认 bucket: ai-cut
└── workspaces/
    └── {workspace_id}/
        ├── shared/                       # Workspace 级共享
        │   ├── characters/{character_id}/{filename}
        │   ├── scenes/{scene_id}/{filename}
        │   ├── props/{prop_id}/{filename}
        │   ├── bgm/{asset_id}.{ext}
        │   ├── materials/{material_id}/attachments/
        │   └── templates/{template_id}/
        └── projects/
            └── {project_id}/
                ├── images/{asset_id}.{ext}
                ├── videos/{asset_id}.{ext}
                ├── audio/{asset_id}.{ext}      # TTS
                ├── subtitles/{asset_id}.{ext}  # SRT/ASS/WebVTT
                ├── exports/{export_id}/{filename}
                ├── thumbnails/{asset_id}.{ext}
                └── covers/{asset_id}.{ext}
```

## storage_key 示例

```text
workspaces/ws-uuid/projects/proj-uuid/videos/asset-uuid.mp4
workspaces/ws-uuid/shared/bgm/asset-uuid.mp3
```

## assets 表必填字段

| 字段 | 说明 |
|------|------|
| storage_bucket | 如 `ai-cut` |
| storage_key | 上例路径 |
| sha256 | 去重 / 完整性 |
| size_bytes | |
| mime_type | |
| kind | image/video/audio/bgm/sfx/subtitle/thumbnail/cover/export |
| workspace_id | 必填 |
| project_id | 可空（共享 BGM） |

## 开发环境

- 可继续映射 `~/Desktop/AI-Veo/` → 同一 `storage_key` 抽象
- `legacy_filepath` 字段保留原路径至迁移完成

## 禁止

- ❌ `music_assets` / `voice_assets` / `subtitle_assets` 独立表存文件
- ❌ 各 Center 私有目录无 `assets` 登记

## VIEW 语义分区（已建）

`image_assets`, `video_assets`, `audio_assets`, `thumbnail_assets`, `export_assets`, `subtitle_assets` — 均为 `assets` 视图。
