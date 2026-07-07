/**
 * AI Cut V1 — 对象存储类型定义
 *
 * M0：仅接口与 Local Provider 骨架。
 * 业务代码（app/）本阶段不得引用；第二阶段经 StorageService 门面接入。
 */

export type StorageProviderKind =
  | "local"
  | "minio"
  | "s3"
  | "gcs"
  | "azure";

export interface StorageObjectMeta {
  bucket: string;
  key: string;
  sizeBytes?: number;
  mimeType?: string;
  sha256?: string;
  etag?: string;
  lastModified?: Date;
}

export interface PutObjectInput {
  bucket: string;
  key: string;
  body: Buffer | Uint8Array | ReadableStream<Uint8Array>;
  mimeType?: string;
  metadata?: Record<string, string>;
}

export interface GetObjectResult {
  body: Buffer;
  meta: StorageObjectMeta;
}

export interface ListObjectsInput {
  bucket: string;
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface ListObjectsResult {
  items: StorageObjectMeta[];
  nextCursor?: string;
}

export interface SignedUrlOptions {
  expiresInSec?: number;
  contentDisposition?: string;
}

export interface StorageProviderConfig {
  kind: StorageProviderKind;
  defaultBucket: string;
  /** Local: 根目录绝对路径 */
  localRoot?: string;
  /** S3/MinIO/GCS/Azure: 连接参数（M0 预留） */
  endpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}
