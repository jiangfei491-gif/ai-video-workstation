import type { IcInstallTask, IcReviewItem } from "../types";
import { runGitClone } from "./git-install";

/**
 * Plugin Installer。
 * 真实实现：git clone（浅克隆、跳过 LFS、host 白名单），绝不执行下载后的代码。
 * 主安装流程见 review-queue/queue.ts 的 installRecord()；此处保留通用接口。
 */
export interface IcInstaller {
  readonly connected: boolean;
  createTask(reviewItem: IcReviewItem, kind: IcInstallTask["kind"], target: string): IcInstallTask;
  run(task: IcInstallTask): Promise<{ ok: boolean; note: string; path?: string }>;
}

export class RealInstaller implements IcInstaller {
  readonly connected = true;

  createTask(reviewItem: IcReviewItem, kind: IcInstallTask["kind"], target: string): IcInstallTask {
    return {
      id: `${reviewItem.id}-install`,
      reviewItemId: reviewItem.id,
      kind,
      target,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
  }

  /** target 为 git 地址；dest 由调用方决定时可传 destPath */
  async run(task: IcInstallTask, destPath?: string): Promise<{ ok: boolean; note: string; path?: string }> {
    const dest = destPath ?? task.target;
    const result = await runGitClone(task.target, dest);
    return { ok: result.ok, note: result.log, path: result.path };
  }
}

let installer: IcInstaller | null = null;
export function getIcInstaller(): IcInstaller {
  if (!installer) installer = new RealInstaller();
  return installer;
}
