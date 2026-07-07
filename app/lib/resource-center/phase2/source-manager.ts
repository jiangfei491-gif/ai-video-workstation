import { DEFAULT_WORKSPACE_ID } from "@/database/migrations/unification/constants";
import type { ResourceCenterRepositoryBundle } from "@/database/repositories/resource-center";
import type {
  ResourceSourceInput,
  ResourceSourceQuery,
} from "@/database/repositories/resource-center/interfaces";
import { getResourceCenterRepos } from "@/database/repositories/resource-center";

import { requireCrawlerProvider } from "./crawler/registry";
import { resolveDownloadsRoot } from "./paths";

export class SourceManager {
  constructor(private readonly repos: ResourceCenterRepositoryBundle = getResourceCenterRepos()) {}

  async list(workspaceId = DEFAULT_WORKSPACE_ID, query?: ResourceSourceQuery) {
    return this.repos.source.list(workspaceId, query);
  }

  async get(id: string) {
    return this.repos.source.findById(id);
  }

  async create(input: ResourceSourceInput, workspaceId = DEFAULT_WORKSPACE_ID) {
    return this.repos.source.create(workspaceId, input);
  }

  async update(id: string, patch: Partial<ResourceSourceInput>) {
    return this.repos.source.update(id, patch);
  }

  async remove(id: string) {
    return this.repos.source.softDelete(id);
  }

  async setEnabled(id: string, enabled: boolean) {
    return this.repos.source.update(id, { enabled, status: enabled ? "active" : "disabled" });
  }

  async stats(workspaceId = DEFAULT_WORKSPACE_ID) {
    return this.repos.source.stats(workspaceId);
  }

  async testConnection(id: string) {
    const source = await this.repos.source.findById(id);
    if (!source) throw new Error("资源站不存在");
    const provider = requireCrawlerProvider(source.provider_slug);
    const result = await provider.testConnection(source);
    if (!result.ok) {
      await this.repos.source.update(id, { status: "error" });
    } else {
      await this.repos.source.update(id, { status: "active", last_updated_at: new Date().toISOString() });
    }
    return result;
  }

  ensureDownloadsLayout(): string {
    const root = resolveDownloadsRoot();
    return root;
  }
}

let singleton: SourceManager | null = null;

export function getSourceManager(): SourceManager {
  if (!singleton) singleton = new SourceManager();
  return singleton;
}
