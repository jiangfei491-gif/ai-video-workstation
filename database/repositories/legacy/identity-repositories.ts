import type {
  IUserRepository,
  IWorkspaceRepository,
  UUID,
} from "../interfaces";
import { DEFAULT_DEV_USER, DEFAULT_DEV_WORKSPACE } from "./registry-data";

export class LegacyUserRepository implements IUserRepository {
  async findById(id: UUID): Promise<unknown | null> {
    return id === DEFAULT_DEV_USER.id ? DEFAULT_DEV_USER : null;
  }

  async findByEmail(email: string): Promise<unknown | null> {
    return email === DEFAULT_DEV_USER.email ? DEFAULT_DEV_USER : null;
  }
}

export class LegacyWorkspaceRepository implements IWorkspaceRepository {
  async findById(id: UUID): Promise<unknown | null> {
    return id === DEFAULT_DEV_WORKSPACE.id ? DEFAULT_DEV_WORKSPACE : null;
  }

  async findBySlug(slug: string): Promise<unknown | null> {
    return slug === DEFAULT_DEV_WORKSPACE.slug ? DEFAULT_DEV_WORKSPACE : null;
  }

  async listMembers(_workspaceId: UUID): Promise<unknown[]> {
    return [{ user_id: DEFAULT_DEV_USER.id, role: "owner" }];
  }
}
