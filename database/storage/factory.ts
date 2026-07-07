import { getDatabaseInfraConfig } from "../config";
import { getWorkspaceManager } from "../workspace";
import type { IStorageProvider, IStorageProviderFactory } from "./storage-provider";
import type { StorageProviderConfig, StorageProviderKind } from "./types";
import { LocalStorageProvider } from "./providers/local-storage-provider";
import { MinioStorageProvider } from "./providers/minio-storage-provider";
import { GcsStorageProvider } from "./providers/gcs-storage-provider";
import { AzureBlobStorageProvider } from "./providers/azure-storage-provider";

class StorageProviderFactory implements IStorageProviderFactory {
  create(config: StorageProviderConfig): IStorageProvider {
    switch (config.kind) {
      case "local":
        return LocalStorageProvider.fromConfig(config);
      case "minio":
      case "s3":
        return new MinioStorageProvider(config);
      case "gcs":
        return new GcsStorageProvider(config);
      case "azure":
        return new AzureBlobStorageProvider(config);
      default:
        return LocalStorageProvider.fromConfig(config);
    }
  }

  getDefault(): IStorageProvider {
    const ws = getWorkspaceManager();
    const cfg = getDatabaseInfraConfig();
    return this.create({
      kind: (cfg.storageProvider as StorageProviderKind) ?? "local",
      defaultBucket: cfg.storageDefaultBucket,
      localRoot: ws.storageRoot,
    });
  }
}

let factory: StorageProviderFactory | null = null;

export function createStorageProviderFactory(): IStorageProviderFactory {
  if (!factory) factory = new StorageProviderFactory();
  return factory;
}

export function getDefaultStorageProvider(): IStorageProvider {
  return createStorageProviderFactory().getDefault();
}
