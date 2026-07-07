/** M0 预留 — Azure Blob Storage */
import type { IStorageProvider } from "../storage-provider";
import type { StorageProviderConfig } from "../types";

export class AzureBlobStorageProvider implements IStorageProvider {
  readonly kind = "azure" as const;
  constructor(_config: StorageProviderConfig) {
    throw new Error("[M0] AzureBlobStorageProvider 尚未实现");
  }
  resolvePublicUrl(): string {
    throw new Error("[M0] AzureBlobStorageProvider 尚未实现");
  }
  putObject(): Promise<never> {
    throw new Error("[M0] AzureBlobStorageProvider 尚未实现");
  }
  getObject(): Promise<never> {
    throw new Error("[M0] AzureBlobStorageProvider 尚未实现");
  }
  headObject(): Promise<never> {
    throw new Error("[M0] AzureBlobStorageProvider 尚未实现");
  }
  deleteObject(): Promise<never> {
    throw new Error("[M0] AzureBlobStorageProvider 尚未实现");
  }
  listObjects(): Promise<never> {
    throw new Error("[M0] AzureBlobStorageProvider 尚未实现");
  }
  getSignedUrl(): Promise<never> {
    throw new Error("[M0] AzureBlobStorageProvider 尚未实现");
  }
  ping(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
