/**
 * M0 预留 — MinIO Storage Provider
 * 第二阶段实现，本阶段不启用。
 */

import type { IStorageProvider } from "../storage-provider";
import type { StorageProviderConfig } from "../types";

export class MinioStorageProvider implements IStorageProvider {
  readonly kind = "minio" as const;

  constructor(_config: StorageProviderConfig) {
    throw new Error("[M0] MinioStorageProvider 尚未实现");
  }

  resolvePublicUrl(): string {
    throw new Error("[M0] MinioStorageProvider 尚未实现");
  }
  putObject(): Promise<never> {
    throw new Error("[M0] MinioStorageProvider 尚未实现");
  }
  getObject(): Promise<never> {
    throw new Error("[M0] MinioStorageProvider 尚未实现");
  }
  headObject(): Promise<never> {
    throw new Error("[M0] MinioStorageProvider 尚未实现");
  }
  deleteObject(): Promise<never> {
    throw new Error("[M0] MinioStorageProvider 尚未实现");
  }
  listObjects(): Promise<never> {
    throw new Error("[M0] MinioStorageProvider 尚未实现");
  }
  getSignedUrl(): Promise<never> {
    throw new Error("[M0] MinioStorageProvider 尚未实现");
  }
  ping(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
