import type { IcDiscoveredItem, IcReviewItem, IcUpgradeRecommendation } from "../types";
import { deriveInstall, installDestFor, runGitClone } from "../installer/git-install";
import {
  getRecord,
  listRecords,
  updateRecord,
  upsertRecord,
  type IcReviewAction,
  type IcReviewRecord,
  type IcReviewStatus,
} from "./store";

/**
 * Review Queue（审核队列）——持久化 + 人工确认 + 安装（git clone，不执行代码）。
 * AI 的推荐必须人工「通过」后才可「安装」。见 [[intelligence-center-providers]]。
 */

function actionFor(module: string, worth: boolean): IcReviewAction {
  if (!worth) return "add_feature";
  return module && module !== "无" ? "upgrade_module" : "add_project";
}

export interface EnqueueInput {
  item: IcDiscoveredItem;
  score: number;
  module: string;
  worth: boolean;
  reason: string;
  tags: string[];
  scoredBy: string;
}

/** 把打分结果加入审核队列（去重：同 item 已在队列则返回原记录） */
export function enqueueScored(input: EnqueueInput): IcReviewRecord {
  const id = `${input.item.id}-review`;
  const existing = getRecord(id);
  if (existing) return existing;
  const derived = deriveInstall(input.item);
  const rec: IcReviewRecord = {
    id,
    platformId: input.item.platformId,
    item: input.item,
    score: input.score,
    module: input.module,
    worth: input.worth,
    reason: input.reason,
    tags: input.tags,
    scoredBy: input.scoredBy,
    action: actionFor(input.module, input.worth),
    status: "review",
    decidedBy: null,
    createdAt: new Date().toISOString(),
    decidedAt: null,
    install: {
      kind: derived?.kind ?? "none",
      gitUrl: derived?.gitUrl,
      status: "pending",
    },
  };
  return upsertRecord(rec);
}

export function listReviewRecords(status?: IcReviewStatus): IcReviewRecord[] {
  return listRecords(status);
}

export function approveRecord(id: string, by = "user"): IcReviewRecord | null {
  return updateRecord(id, { status: "approved", decidedBy: by, decidedAt: new Date().toISOString() });
}

export function rejectRecord(id: string, by = "user"): IcReviewRecord | null {
  return updateRecord(id, { status: "rejected", decidedBy: by, decidedAt: new Date().toISOString() });
}

/**
 * 执行安装（仅在已通过后允许）。只做 git clone，绝不执行仓库内代码。
 */
export async function installRecord(id: string): Promise<IcReviewRecord | null> {
  const rec = getRecord(id);
  if (!rec) return null;
  if (rec.status !== "approved" && rec.status !== "failed") {
    return updateRecord(id, {
      install: {
        ...(rec.install ?? { kind: "none", status: "pending" }),
        status: "failed",
        log: "未通过审核，禁止安装",
      },
    });
  }
  const derived = rec.install?.gitUrl
    ? { kind: rec.install.kind, gitUrl: rec.install.gitUrl }
    : deriveInstall(rec.item);
  if (!derived || derived.kind === "none" || !derived.gitUrl) {
    return updateRecord(id, {
      status: "failed",
      install: { kind: "none", status: "failed", log: "该项无可用 git 源，不支持自动安装（可手动收藏链接）" },
    });
  }

  updateRecord(id, {
    status: "installing",
    install: {
      ...rec.install!,
      kind: derived.kind,
      gitUrl: derived.gitUrl,
      status: "installing",
      startedAt: new Date().toISOString(),
    },
  });

  const dest = installDestFor(rec.item);
  const result = await runGitClone(derived.gitUrl, dest);

  return updateRecord(id, {
    status: result.ok ? "installed" : "failed",
    install: {
      kind: derived.kind,
      gitUrl: derived.gitUrl,
      path: result.path,
      status: result.ok ? "installed" : "failed",
      log: result.log,
      startedAt: rec.install?.startedAt ?? new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    },
  });
}

// ---- 旧接口（保持 index.ts 兼容；内部走持久化 store）----
export function enqueueReview(rec: IcUpgradeRecommendation, action: IcReviewItem["action"]): IcReviewItem {
  return {
    id: `${rec.id}-review`,
    recommendationId: rec.id,
    action,
    status: "review",
    decidedBy: null,
    createdAt: new Date().toISOString(),
  };
}
export function listReview(status?: IcReviewStatus) {
  return listReviewRecords(status);
}
export function approveReview(id: string, by = "user") {
  return approveRecord(id, by);
}
export function rejectReview(id: string, by = "user") {
  return rejectRecord(id, by);
}
