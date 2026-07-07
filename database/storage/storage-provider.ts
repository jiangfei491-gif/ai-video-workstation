/**
 * AI Cut V1 — 统一 Storage Provider 接口
 *
 * 所有媒体二进制读写必须经过此接口（第二阶段接入 assets 表）。
 * M0 不接入业务；默认 Local Storage。
 */

import type {
  GetObjectResult,
  ListObjectsInput,
  ListObjectsResult,
  PutObjectInput,
  SignedUrlOptions,
  StorageObjectMeta,
  StorageProviderConfig,
  StorageProviderKind,
} from "./types";

export interface IStorageProvider {
  readonly kind: StorageProviderKind;

  /** 解析 storage_key → 可读 URL（Local 为 file:// 或 /api/files 路径） */
  resolvePublicUrl(meta: Pick<StorageObjectMeta, "bucket" | "key">): string;

  putObject(input: PutObjectInput): Promise<StorageObjectMeta>;
  getObject(bucket: string, key: string): Promise<GetObjectResult>;
  headObject(bucket: string, key: string): Promise<StorageObjectMeta | null>;
  deleteObject(bucket: string, key: string): Promise<void>;
  listObjects(input: ListObjectsInput): Promise<ListObjectsResult>;

  /** 预签名 URL（S3/MinIO 等；Local 可返回 resolvePublicUrl） */
  getSignedUrl(
    bucket: string,
    key: string,
    options?: SignedUrlOptions
  ): Promise<string>;

  /** 健康检查 */
  ping(): Promise<boolean>;
}

export interface IStorageProviderFactory {
  create(config: StorageProviderConfig): IStorageProvider;
  getDefault(): IStorageProvider;
}

/** P2：工厂实现 — 默认 Local */
export { createStorageProviderFactory, getDefaultStorageProvider } from "./factory";
