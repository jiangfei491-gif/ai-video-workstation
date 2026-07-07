/**
 * AI Cut V1 — Local Storage Provider（M0 默认）
 *
 * 映射 storage_key 到本地文件系统。
 * 不修改 app/ 现有文件访问逻辑；仅供 Repository / 迁移脚本使用。
 */

import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat, unlink, readdir } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import type { IStorageProvider } from "../storage-provider";
import type {
  GetObjectResult,
  ListObjectsInput,
  ListObjectsResult,
  PutObjectInput,
  SignedUrlOptions,
  StorageObjectMeta,
  StorageProviderConfig,
} from "../types";

import { resolveInitialWorkspaceRoot } from "../../workspace";

export class LocalStorageProvider implements IStorageProvider {
  readonly kind = "local" as const;

  constructor(
    private readonly root: string,
    private readonly defaultBucket: string
  ) {}

  static fromConfig(config: StorageProviderConfig): LocalStorageProvider {
    const root = config.localRoot ?? resolveInitialWorkspaceRoot();
    return new LocalStorageProvider(resolve(root), config.defaultBucket);
  }

  private absPath(bucket: string, key: string): string {
    const normalized = normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    return resolve(this.root, bucket, normalized);
  }

  resolvePublicUrl(meta: Pick<StorageObjectMeta, "bucket" | "key">): string {
    return this.absPath(meta.bucket, meta.key);
  }

  async putObject(input: PutObjectInput): Promise<StorageObjectMeta> {
    const abs = this.absPath(input.bucket, input.key);
    await mkdir(dirname(abs), { recursive: true });

    if (Buffer.isBuffer(input.body) || input.body instanceof Uint8Array) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(abs, input.body);
    } else if (input.body instanceof ReadableStream) {
      const nodeStream = Readable.fromWeb(input.body as import("stream/web").ReadableStream);
      await pipeline(nodeStream, createWriteStream(abs));
    } else {
      await pipeline(input.body as NodeJS.ReadableStream, createWriteStream(abs));
    }

    const st = await stat(abs);
    return {
      bucket: input.bucket,
      key: input.key,
      sizeBytes: st.size,
      mimeType: input.mimeType,
      lastModified: st.mtime,
    };
  }

  async getObject(bucket: string, key: string): Promise<GetObjectResult> {
    const abs = this.absPath(bucket, key);
    const body = await readFile(abs);
    const st = await stat(abs);
    return {
      body,
      meta: {
        bucket,
        key,
        sizeBytes: st.size,
        lastModified: st.mtime,
      },
    };
  }

  async headObject(bucket: string, key: string): Promise<StorageObjectMeta | null> {
    try {
      const abs = this.absPath(bucket, key);
      const st = await stat(abs);
      return { bucket, key, sizeBytes: st.size, lastModified: st.mtime };
    } catch {
      return null;
    }
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await unlink(this.absPath(bucket, key));
  }

  async listObjects(input: ListObjectsInput): Promise<ListObjectsResult> {
    const prefix = input.prefix ?? "";
    const base = this.absPath(input.bucket, prefix);
    const items: StorageObjectMeta[] = [];

    async function walk(dir: string, relPrefix: string): Promise<void> {
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        return;
      }
      for (const name of entries) {
        if (items.length >= (input.limit ?? 1000)) return;
        const full = join(dir, name);
        const rel = relPrefix ? `${relPrefix}/${name}` : name;
        const st = await stat(full);
        if (st.isDirectory()) {
          await walk(full, rel);
        } else {
          items.push({
            bucket: input.bucket,
            key: prefix ? `${prefix.replace(/\/$/, "")}/${rel}` : rel,
            sizeBytes: st.size,
            lastModified: st.mtime,
          });
        }
      }
    }

    await walk(base, "");
    return { items };
  }

  async getSignedUrl(
    bucket: string,
    key: string,
    _options?: SignedUrlOptions
  ): Promise<string> {
    return this.resolvePublicUrl({ bucket, key });
  }

  async ping(): Promise<boolean> {
    try {
      await stat(this.root);
      return true;
    } catch {
      return false;
    }
  }
}

/** storage_key（无 bucket 前缀）→ 本地路径 */
export function localPathFromStorageKey(
  root: string,
  storageKey: string,
  bucket = "ai-cut"
): string {
  return LocalStorageProvider.fromConfig({
    kind: "local",
    defaultBucket: bucket,
    localRoot: root,
  }).resolvePublicUrl({ bucket, key: storageKey });
}
