# Storage 层（M0）

> 统一对象存储抽象。二进制 **不进 PostgreSQL**。

## 结构

```text
database/storage/
├── types.ts                          # 类型定义
├── storage-provider.ts               # IStorageProvider 接口
└── providers/
    ├── local-storage-provider.ts     # ✅ M0 默认（已实现骨架）
    ├── minio-storage-provider.ts     # ⏸ 预留
    ├── s3-storage-provider.ts        # ⏸ 预留
    ├── gcs-storage-provider.ts       # ⏸ 预留
    └── azure-storage-provider.ts     # ⏸ 预留
```

## 默认 Provider

| 环境变量 | 默认 |
|----------|------|
| `STORAGE_PROVIDER` | `local` |
| `STORAGE_LOCAL_ROOT` | `~/Desktop/AI-Veo` |

## 规范

- 业务代码 **本阶段不引用** `database/storage`
- 第二阶段经 `StorageService` 门面 + `IAssetRepository` 登记 `assets` 表
- `storage_key` 格式见 `docs/object-storage.md`

## Provider 支持矩阵

| Provider | M0 | 说明 |
|----------|-----|------|
| Local | ✅ | 开发默认 |
| MinIO | 接口占位 | 自建 S3 兼容 |
| S3 | 接口占位 | AWS |
| GCS | 接口占位 | Google Cloud |
| Azure Blob | 接口占位 | Azure |
